/**
 * TV catalogue responses.
 *
 * GET /api/browse/browsetv returns one summary per series.
 * GET /api/browse/tv/:seriesId returns the same summary plus `nodes`, the
 * manifest tree. A node with `url` is playable. A node without `url` groups
 * its `children` (a season, an episode that has several versions, or an
 * extras group). Stream that url through /api/stream/tv/:seriesId/nodes/:nodeId.
 *
 * `label` is the JSON key. `title` is set when the manifest or TMDB gave the
 * node a name. Numbered episodes keep a null title until TMDB fills it, so
 * the UI can show the episode number from `label` or `episodeNumber`.
 */

import type { InferSelectModel } from "drizzle-orm";
import {
  getStreamFileName,
  type CastMemberResponse,
  type CrewMemberResponse,
  type ExtraResponse,
  type GenreResponse,
  type SubtitleTrackResponse,
} from "../../shared/movies/movieResponse.js";
import type {
  localSeries,
  localSeriesCast,
  localSeriesCrew,
  localSeriesGenres,
} from "../../infra/db/schema.js";
import type { TvNodeKind } from "./parseTvManifest.js";

export interface TvContentNode {
  id: number;
  kind: TvNodeKind;
  label: string;
  title: string | null;
  runtime: string | null;
  /** TMDB episode overview. */
  overview: string | null;
  /** TMDB still path, the same shape as a poster path. */
  stillPath: string | null;
  /** Relative stream path, or null when this node only groups children. */
  url: string | null;
  /** Sidecar WebVTT tracks for an .mp4 or .webm file. Empty for every other node. */
  subtitles: SubtitleTrackResponse[];
  seasonNumber: number | null;
  episodeNumber: number | null;
  children: TvContentNode[];
}

export interface SeriesSummary {
  id: number;
  mediaType: "tv";
  adult: boolean;
  homepage: string | null;
  imdbId: string | null;
  originalLanguage: string | null;
  originalTitle: string | null;
  overview: string | null;
  popularity: number;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  year: number | null;
  runtime: number;
  tagline: string | null;
  title: string | null;
  voteAverage: number;
  voteCount: number;
  /** A series is not one file. Play a node from the detail tree instead. */
  url: string;
  hasExtras: boolean;
  seasonCount: number;
  episodeCount: number;
  cast: CastMemberResponse[];
  crew: CrewMemberResponse[];
  genres: GenreResponse[];
  /** Always empty. Extras are nodes on the series detail, not a flat list. */
  extras: ExtraResponse[];
}

export interface SeriesDetail extends SeriesSummary {
  nodes: TvContentNode[];
}

export interface TvBrowseResult {
  page: number;
  results: SeriesSummary[];
  totalPages: number;
  totalResults: number;
}

export interface TvSearchResult {
  query: string;
  totalResults: number;
  results: SeriesSummary[];
}

export interface SeriesNodeRecord {
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

export interface SeriesCatalogueEntry extends InferSelectModel<typeof localSeries> {
  seasonCount: number;
  episodeCount: number;
  cast: InferSelectModel<typeof localSeriesCast>[];
  crew: InferSelectModel<typeof localSeriesCrew>[];
  genres: InferSelectModel<typeof localSeriesGenres>[];
}

const NODE_KINDS = new Set<TvNodeKind>([
  "season",
  "episode",
  "version",
  "extras",
  "group",
  "media",
]);

export function mapSeriesSummary(series: SeriesCatalogueEntry): SeriesSummary {
  return {
    id: series.id,
    mediaType: "tv",
    adult: series.adult,
    homepage: series.homepage,
    imdbId: series.imdbId,
    originalLanguage: series.originalLanguage,
    originalTitle: series.originalTitle,
    overview: series.overview,
    popularity: series.popularity,
    posterPath: series.posterPath,
    backdropPath: series.backdropPath,
    releaseDate: series.releaseDate,
    year: series.year,
    runtime: series.runtime,
    tagline: series.tagline,
    title: series.title,
    voteAverage: series.voteAverage,
    voteCount: series.voteCount,
    url: "",
    hasExtras: series.hasExtras,
    seasonCount: series.seasonCount,
    episodeCount: series.episodeCount,
    cast: series.cast.map((member) => ({
      id: member.id,
      adult: member.adult,
      castId: member.castId,
      character: member.character,
      creditId: member.creditId,
      gender: member.gender,
      knownForDepartment: member.knownForDepartment,
      name: member.name,
      order: member.order,
      originalName: member.originalName,
      popularity: member.popularity,
      profilePath: member.profilePath,
    })),
    crew: series.crew.map((member) => ({
      id: member.id,
      adult: member.adult,
      creditId: member.creditId,
      department: member.department,
      gender: member.gender,
      job: member.job,
      knownForDepartment: member.knownForDepartment,
      name: member.name,
      originalName: member.originalName,
      popularity: member.popularity,
      profilePath: member.profilePath,
    })),
    genres: series.genres.map((genre) => ({
      id: genre.id,
      name: genre.name,
    })),
    extras: [],
  };
}

export function mapSeriesDetail(
  series: SeriesCatalogueEntry,
  nodes: SeriesNodeRecord[],
  subtitlesByNodeId: ReadonlyMap<number, SubtitleTrackResponse[]> = new Map(),
): SeriesDetail {
  return {
    ...mapSeriesSummary(series),
    nodes: buildTvContentTree(series.id, nodes, subtitlesByNodeId),
  };
}

export function buildTvContentTree(
  seriesId: number,
  nodes: SeriesNodeRecord[],
  subtitlesByNodeId: ReadonlyMap<number, SubtitleTrackResponse[]> = new Map(),
): TvContentNode[] {
  const byParent = new Map<number | null, SeriesNodeRecord[]>();
  for (const node of nodes) {
    const siblings = byParent.get(node.parentId) ?? [];
    siblings.push(node);
    byParent.set(node.parentId, siblings);
  }

  const toNode = (node: SeriesNodeRecord): TvContentNode => {
    const children = [...(byParent.get(node.id) ?? [])].sort(compareNodes);
    return {
      id: node.id,
      kind: asNodeKind(node.kind),
      label: node.label,
      title: node.title,
      runtime: node.runtime,
      overview: node.overview ?? null,
      stillPath: node.stillPath ?? null,
      url: node.url
        ? `stream/tv/${seriesId}/nodes/${node.id}/${getStreamFileName(node.url)}`
        : null,
      subtitles: subtitlesByNodeId.get(node.id) ?? [],
      seasonNumber: node.seasonNumber,
      episodeNumber: node.episodeNumber,
      children: children.map(toNode),
    };
  };

  return [...(byParent.get(null) ?? [])].sort(compareNodes).map(toNode);
}

function compareNodes(a: SeriesNodeRecord, b: SeriesNodeRecord): number {
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

function asNodeKind(kind: string): TvNodeKind {
  if (NODE_KINDS.has(kind as TvNodeKind)) {
    return kind as TvNodeKind;
  }
  return "group";
}
