/**
 * TV series persistence. One series row per manifest, plus a node per season,
 * episode, version, and extra. Node ids stay stable across rescans when the
 * manifest path (stable key) is unchanged, so playback progress survives.
 */

import { and, asc, eq, inArray, isNotNull, isNull, like, sql } from "drizzle-orm";
import { db } from "../client.js";
import {
  localSeries,
  localSeriesCast,
  localSeriesCrew,
  localSeriesGenres,
  localSeriesNodes,
  localSeriesTrailers,
} from "../schema.js";
import type { InferSelectModel } from "drizzle-orm";
import type { ParsedTvNode } from "../../../modules/tv/parseTvManifest.js";
import type { SeriesCatalogueEntry } from "../../../modules/tv/tvResponse.js";

export const SERIES_PAGE_SIZE = 20;

export interface DiscoveredSeriesData {
  title: string;
  originalTitle?: string;
  overview?: string;
  releaseDate?: string;
  year?: number;
  runtime?: number;
  adult?: boolean;
  popularity?: number;
  voteAverage?: number;
  voteCount?: number;
  posterPath?: string;
  backdropPath?: string;
  homepage?: string;
  imdbId?: string;
  originalLanguage?: string;
  tagline?: string;
  hasExtras: boolean;
  metadataFile: string;
  tmdbId?: number;
}

export interface SeriesMetadataFileRef {
  id: number;
  metadataFile: string;
}

export interface PlayableSeriesNode {
  seriesId: number;
  nodeId: number;
  url: string;
  metadataFile: string;
}

export interface SeriesNodeRef {
  seriesId: number;
  nodeId: number;
  url: string | null;
  metadataFile: string | null;
}

type SeriesRow = InferSelectModel<typeof localSeries>;
type CastRow = InferSelectModel<typeof localSeriesCast>;
type CrewRow = InferSelectModel<typeof localSeriesCrew>;
type GenreRow = InferSelectModel<typeof localSeriesGenres>;

interface SeriesWithRelations extends SeriesRow {
  cast: CastRow[];
  crew: CrewRow[];
  genres: GenreRow[];
}

export function findSeriesIdByMetadataFile(metadataFile: string): number | null {
  const record = db
    .select({ id: localSeries.id })
    .from(localSeries)
    .where(eq(localSeries.metadataFile, metadataFile))
    .limit(1)
    .get();

  return record?.id ?? null;
}

export function isSeriesMissingTmdbById(seriesId: number): boolean {
  const result = db
    .select({
      overview: localSeries.overview,
      posterPath: localSeries.posterPath,
      imdbId: localSeries.imdbId,
    })
    .from(localSeries)
    .where(eq(localSeries.id, seriesId))
    .limit(1)
    .get();

  if (!result) {
    return false;
  }

  if (!result.overview && !result.posterPath && !result.imdbId) {
    return true;
  }

  const incompleteCast = db
    .select({ id: localSeriesCast.id })
    .from(localSeriesCast)
    .where(
      and(
        eq(localSeriesCast.localSeriesId, seriesId),
        isNull(localSeriesCast.creditId),
      ),
    )
    .limit(1)
    .get();

  return !!incompleteCast;
}

export function listSeriesWithMetadataFile(): SeriesMetadataFileRef[] {
  const rows = db
    .select({
      id: localSeries.id,
      metadataFile: localSeries.metadataFile,
    })
    .from(localSeries)
    .where(isNotNull(localSeries.metadataFile))
    .all();

  return rows.filter(
    (row): row is SeriesMetadataFileRef =>
      typeof row.metadataFile === "string" && row.metadataFile.length > 0,
  );
}

export function deleteSeriesByMetadataFile(metadataFile: string): number {
  const result = db
    .delete(localSeries)
    .where(eq(localSeries.metadataFile, metadataFile))
    .run();

  return result.changes;
}

export function insertDiscoveredSeries(
  seriesData: DiscoveredSeriesData,
  nodes: ParsedTvNode[],
): number {
  return db.transaction((tx) => {
    const record = tx
      .insert(localSeries)
      .values(toSeriesValues(seriesData))
      .returning({ id: localSeries.id })
      .get();
    const seriesId = (record as { id: number }).id;
    writeNodes(tx, seriesId, nodes, null, new Map(), new Set());
    return seriesId;
  });
}

export function refreshDiscoveredSeries(
  seriesData: DiscoveredSeriesData,
  nodes: ParsedTvNode[],
): number {
  return db.transaction((tx) => {
    const existing = tx
      .select({ id: localSeries.id })
      .from(localSeries)
      .where(eq(localSeries.metadataFile, seriesData.metadataFile))
      .limit(1)
      .get();

    if (!existing) {
      throw new Error(
        `TV series not found for metadata refresh: ${seriesData.metadataFile}`,
      );
    }

    const seriesId = existing.id;
    tx.update(localSeries)
      .set(toSeriesValues(seriesData))
      .where(eq(localSeries.id, seriesId))
      .run();

    const existingNodes = tx
      .select({
        id: localSeriesNodes.id,
        stableKey: localSeriesNodes.stableKey,
      })
      .from(localSeriesNodes)
      .where(eq(localSeriesNodes.seriesId, seriesId))
      .all();
    const existingByKey = new Map(
      existingNodes.map((node) => [node.stableKey, node.id]),
    );
    const kept = new Set<number>();
    writeNodes(tx, seriesId, nodes, null, existingByKey, kept);

    const staleIds = existingNodes
      .map((node) => node.id)
      .filter((id) => !kept.has(id));
    if (staleIds.length > 0) {
      tx.delete(localSeriesNodes)
        .where(inArray(localSeriesNodes.id, staleIds))
        .run();
    }

    tx.delete(localSeriesCast)
      .where(eq(localSeriesCast.localSeriesId, seriesId))
      .run();
    tx.delete(localSeriesCrew)
      .where(eq(localSeriesCrew.localSeriesId, seriesId))
      .run();
    tx.delete(localSeriesGenres)
      .where(eq(localSeriesGenres.localSeriesId, seriesId))
      .run();
    tx.delete(localSeriesTrailers)
      .where(eq(localSeriesTrailers.localSeriesId, seriesId))
      .run();

    return seriesId;
  });
}

export function insertSeriesCast(
  seriesId: number,
  cast: Array<{
    personId: number;
    name: string;
    character?: string | undefined;
    profilePath?: string | null | undefined;
    order: number;
    adult: boolean;
    castId: number;
    creditId?: string | undefined;
    gender?: number | null | undefined;
    knownForDepartment?: string | undefined;
    originalName?: string | undefined;
    popularity: number;
  }>,
): void {
  if (cast.length === 0) {
    return;
  }

  db.insert(localSeriesCast)
    .values(
      cast.map((member) => ({
        localSeriesId: seriesId,
        adult: member.adult,
        castId: member.castId,
        character: member.character,
        creditId: member.creditId,
        gender: member.gender,
        personId: member.personId,
        knownForDepartment: member.knownForDepartment,
        name: member.name,
        order: member.order,
        originalName: member.originalName,
        popularity: member.popularity,
        profilePath: member.profilePath,
      })),
    )
    .run();
}

export function insertSeriesCrew(
  seriesId: number,
  crew: Array<{
    personId: number;
    name: string;
    job?: string | undefined;
    department?: string | undefined;
    profilePath?: string | null | undefined;
    adult: boolean;
    creditId?: string | undefined;
    gender?: number | null | undefined;
    knownForDepartment?: string | undefined;
    originalName?: string | undefined;
    popularity: number;
  }>,
): void {
  if (crew.length === 0) {
    return;
  }

  db.insert(localSeriesCrew)
    .values(
      crew.map((member) => ({
        localSeriesId: seriesId,
        adult: member.adult,
        creditId: member.creditId,
        department: member.department,
        gender: member.gender,
        personId: member.personId,
        job: member.job,
        knownForDepartment: member.knownForDepartment,
        name: member.name,
        originalName: member.originalName,
        popularity: member.popularity,
        profilePath: member.profilePath,
      })),
    )
    .run();
}

export function insertSeriesGenres(
  seriesId: number,
  genres: Array<{ id: number; name: string }>,
): void {
  if (genres.length === 0) {
    return;
  }

  db.insert(localSeriesGenres)
    .values(
      genres.map((genre) => ({
        localSeriesId: seriesId,
        genreId: genre.id,
        name: genre.name,
      })),
    )
    .run();
}

export function insertSeriesTrailer(
  seriesId: number,
  trailer?: {
    key: string;
    name: string;
    site: string;
    type: string;
    official: boolean;
    publishedAt: string;
    iso6391?: string;
    iso31661?: string;
    size?: number;
  },
): void {
  if (!trailer) {
    return;
  }

  db.insert(localSeriesTrailers)
    .values({
      localSeriesId: seriesId,
      key: trailer.key,
      name: trailer.name,
      site: trailer.site,
      type: trailer.type,
      official: trailer.official,
      publishedAt: trailer.publishedAt,
      iso6391: trailer.iso6391,
      iso31661: trailer.iso31661,
      size: trailer.size || 0,
    })
    .run();
}

export async function getSeriesPage(
  tvPath: string,
  page: number,
): Promise<{ series: SeriesCatalogueEntry[]; totalCount: number }> {
  const pattern = libraryPattern(tvPath);
  const offset = (page - 1) * SERIES_PAGE_SIZE;
  const totalCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(localSeries)
      .where(like(localSeries.metadataFile, pattern))
      .get()?.count ?? 0;

  const rows = (await db.query.localSeries.findMany({
    with: {
      cast: true,
      crew: true,
      genres: true,
    },
    where: (series, { like: lk }) => lk(series.metadataFile, pattern),
    orderBy: (series, { asc: ascending }) => [ascending(series.title)],
    limit: SERIES_PAGE_SIZE,
    offset,
  })) as SeriesWithRelations[];

  return { series: withStructureCounts(rows), totalCount };
}

export async function searchSeriesByTitle(
  query: string,
  tvPath: string,
): Promise<SeriesCatalogueEntry[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const rows = (await db.query.localSeries.findMany({
    with: {
      cast: true,
      crew: true,
      genres: true,
    },
    where: (series, operators) =>
      operators.and(
        operators.like(series.metadataFile, libraryPattern(tvPath)),
        operators.like(series.title, `%${trimmed}%`),
      ),
    orderBy: (series, { asc: ascending }) => [ascending(series.title)],
    limit: 100,
  })) as SeriesWithRelations[];

  return withStructureCounts(rows);
}

export async function getSeriesDetailRecord(
  tvPath: string,
  seriesId: number,
): Promise<{ series: SeriesCatalogueEntry; nodes: SeriesNodeRow[] } | null> {
  const pattern = libraryPattern(tvPath);
  const series = (await db.query.localSeries.findFirst({
    with: {
      cast: true,
      crew: true,
      genres: true,
    },
    where: (row, operators) =>
      operators.and(
        operators.eq(row.id, seriesId),
        operators.like(row.metadataFile, pattern),
      ),
  })) as SeriesWithRelations | undefined;

  if (!series) {
    return null;
  }

  const nodes = listSeriesNodes(seriesId);
  const [entry] = withStructureCounts([series]);
  if (!entry) {
    return null;
  }

  return { series: entry, nodes };
}

export function listSeriesNodes(seriesId: number): SeriesNodeRow[] {
  return db
    .select({
      id: localSeriesNodes.id,
      parentId: localSeriesNodes.parentId,
      kind: localSeriesNodes.kind,
      label: localSeriesNodes.label,
      title: localSeriesNodes.title,
      runtime: localSeriesNodes.runtime,
      overview: localSeriesNodes.overview,
      stillPath: localSeriesNodes.stillPath,
      url: localSeriesNodes.url,
      sortOrder: localSeriesNodes.sortOrder,
      seasonNumber: localSeriesNodes.seasonNumber,
      episodeNumber: localSeriesNodes.episodeNumber,
    })
    .from(localSeriesNodes)
    .where(eq(localSeriesNodes.seriesId, seriesId))
    .orderBy(asc(localSeriesNodes.sortOrder), asc(localSeriesNodes.id))
    .all();
}

export function getPlayableSeriesNode(
  seriesId: number,
  nodeId: number,
): PlayableSeriesNode | undefined {
  const row = db
    .select({
      seriesId: localSeriesNodes.seriesId,
      nodeId: localSeriesNodes.id,
      url: localSeriesNodes.url,
      metadataFile: localSeries.metadataFile,
    })
    .from(localSeriesNodes)
    .innerJoin(localSeries, eq(localSeriesNodes.seriesId, localSeries.id))
    .where(
      and(eq(localSeriesNodes.id, nodeId), eq(localSeriesNodes.seriesId, seriesId)),
    )
    .get();

  if (!row?.url || !row.metadataFile) {
    return undefined;
  }

  return {
    seriesId: row.seriesId,
    nodeId: row.nodeId,
    url: row.url,
    metadataFile: row.metadataFile,
  };
}

export function getSeriesNodeById(nodeId: number): SeriesNodeRef | undefined {
  const row = db
    .select({
      seriesId: localSeriesNodes.seriesId,
      nodeId: localSeriesNodes.id,
      url: localSeriesNodes.url,
      metadataFile: localSeries.metadataFile,
    })
    .from(localSeriesNodes)
    .innerJoin(localSeries, eq(localSeriesNodes.seriesId, localSeries.id))
    .where(eq(localSeriesNodes.id, nodeId))
    .get();

  if (!row) {
    return undefined;
  }

  return row;
}

export interface SeriesNodeRow {
  id: number;
  parentId: number | null;
  kind: string;
  label: string;
  title: string | null;
  runtime: string | null;
  overview: string | null;
  stillPath: string | null;
  url: string | null;
  sortOrder: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

type NodeWriter = Pick<typeof db, "insert" | "update">;

function writeNodes(
  tx: NodeWriter,
  seriesId: number,
  nodes: ParsedTvNode[],
  parentId: number | null,
  existingByKey: Map<string, number>,
  kept: Set<number>,
): void {
  for (const node of nodes) {
    const values = {
      seriesId,
      parentId,
      stableKey: node.stableKey,
      sortOrder: node.sortOrder,
      kind: node.kind,
      label: node.label,
      title: node.title,
      runtime: node.runtime,
      overview: node.overview ?? null,
      stillPath: node.stillPath ?? null,
      url: node.filePath,
      seasonNumber: node.seasonNumber,
      episodeNumber: node.episodeNumber,
    };
    const existingId = existingByKey.get(node.stableKey);
    const id = existingId
      ? updateNode(tx, existingId, values)
      : insertNode(tx, values);
    kept.add(id);
    writeNodes(tx, seriesId, node.children, id, existingByKey, kept);
  }
}

function updateNode(
  tx: NodeWriter,
  id: number,
  values: NodeValues,
): number {
  tx.update(localSeriesNodes)
    .set(values)
    .where(eq(localSeriesNodes.id, id))
    .run();
  return id;
}

function insertNode(tx: NodeWriter, values: NodeValues): number {
  const record = tx
    .insert(localSeriesNodes)
    .values(values)
    .returning({ id: localSeriesNodes.id })
    .get();
  return (record as { id: number }).id;
}

interface NodeValues {
  seriesId: number;
  parentId: number | null;
  stableKey: string;
  sortOrder: number;
  kind: string;
  label: string;
  title: string | null;
  runtime: string | null;
  overview: string | null;
  stillPath: string | null;
  url: string | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
}

function toSeriesValues(seriesData: DiscoveredSeriesData) {
  return {
    title: seriesData.title,
    originalTitle: seriesData.originalTitle ?? null,
    overview: seriesData.overview ?? null,
    releaseDate: seriesData.releaseDate ?? null,
    year: seriesData.year ?? null,
    runtime: seriesData.runtime ?? 0,
    adult: seriesData.adult ?? false,
    popularity: seriesData.popularity ?? 0,
    voteAverage: seriesData.voteAverage ?? 0,
    voteCount: seriesData.voteCount ?? 0,
    posterPath: seriesData.posterPath ?? null,
    backdropPath: seriesData.backdropPath ?? null,
    homepage: seriesData.homepage ?? null,
    imdbId: seriesData.imdbId ?? null,
    originalLanguage: seriesData.originalLanguage ?? null,
    tagline: seriesData.tagline ?? null,
    hasExtras: seriesData.hasExtras,
    metadataFile: seriesData.metadataFile,
    tmdbId: seriesData.tmdbId ?? null,
  };
}

function withStructureCounts(rows: SeriesWithRelations[]): SeriesCatalogueEntry[] {
  const counts = structureCounts(rows.map((row) => row.id));
  return rows.map((row) => ({
    ...row,
    seasonCount: counts.get(row.id)?.seasonCount ?? 0,
    episodeCount: counts.get(row.id)?.episodeCount ?? 0,
  }));
}

function structureCounts(
  seriesIds: number[],
): Map<number, { seasonCount: number; episodeCount: number }> {
  const counts = new Map<number, { seasonCount: number; episodeCount: number }>();
  if (seriesIds.length === 0) {
    return counts;
  }

  const rows = db
    .select({
      seriesId: localSeriesNodes.seriesId,
      seasonCount: sql<number>`sum(case when ${localSeriesNodes.kind} = 'season' then 1 else 0 end)`,
      episodeCount: sql<number>`sum(case when ${localSeriesNodes.kind} = 'episode' then 1 else 0 end)`,
    })
    .from(localSeriesNodes)
    .where(inArray(localSeriesNodes.seriesId, seriesIds))
    .groupBy(localSeriesNodes.seriesId)
    .all();

  for (const row of rows) {
    counts.set(row.seriesId, {
      seasonCount: Number(row.seasonCount ?? 0),
      episodeCount: Number(row.episodeCount ?? 0),
    });
  }

  return counts;
}

function libraryPattern(tvPath: string): string {
  const normalized = tvPath.replace(/\\/g, "/").replace(/\/?$/, "/");
  return `${normalized}%`;
}
