/**
 * Media Watcher Repository — database operations for scan tracking and movie discovery.
 */

import { eq, desc, and, inArray, isNull, isNotNull } from "drizzle-orm";
import { db } from "../client.js";
import {
  scanStatus,
  localMovies,
  localMovieCast,
  localMovieCrew,
  localMovieGenres,
  localMovieExtras,
  localMovieTrailers,
} from "../schema.js";

export type ScanStatus = "running" | "completed" | "failed";

export interface ScanStatusRecord {
  id: number;
  userName: string;
  scanType: "movies" | "tv";
  status: ScanStatus;
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  errorCount: number;
  startTime: string;
  endTime: string | null;
  errorLog: string | null;
  createdAt: string;
}

export interface DiscoveredMovieData {
  title: string;
  originalTitle?: string;
  overview?: string;
  url: string;
  releaseDate?: string;
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
  hasExtras?: boolean;
  metadataFile?: string | null;
}

export interface MovieMetadataFileRef {
  id: number;
  url: string;
  metadataFile: string;
}

function toMovieValues(movieData: DiscoveredMovieData) {
  return {
    title: movieData.title,
    originalTitle: movieData.originalTitle ?? null,
    overview: movieData.overview ?? null,
    url: movieData.url,
    releaseDate: movieData.releaseDate ?? null,
    runtime: movieData.runtime ?? 0,
    adult: movieData.adult ?? false,
    popularity: movieData.popularity ?? 0,
    voteAverage: movieData.voteAverage ?? 0,
    voteCount: movieData.voteCount ?? 0,
    posterPath: movieData.posterPath ?? null,
    backdropPath: movieData.backdropPath ?? null,
    homepage: movieData.homepage ?? null,
    imdbId: movieData.imdbId ?? null,
    originalLanguage: movieData.originalLanguage ?? null,
    tagline: movieData.tagline ?? null,
    hasExtras: movieData.hasExtras ?? false,
    metadataFile: movieData.metadataFile ?? null,
  };
}

/**
 * Create a new scan status record to track progress.
 */
export function createScanRecord(
  userName: string,
  scanType: "movies" | "tv",
): ScanStatusRecord {
  const now = new Date().toISOString();
  const record = db
    .insert(scanStatus)
    .values({
      userName,
      scanType,
      status: "running",
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errorCount: 0,
      startTime: now,
      endTime: null,
      errorLog: null,
    })
    .returning()
    .get();

  return record as ScanStatusRecord;
}

/**
 * Update scan progress and status.
 */
export function updateScanRecord(
  scanId: number,
  updates: Partial<{
    status: ScanStatus;
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    errorCount: number;
    endTime: string;
    errorLog: string;
  }>,
): void {
  db.update(scanStatus).set(updates).where(eq(scanStatus.id, scanId)).run();
}

/**
 * Get the most recent scan for a user, or null if none.
 */
export function getLatestScanForUser(
  userName: string,
  scanType: "movies" | "tv" = "movies",
): ScanStatusRecord | null {
  const record = db
    .select()
    .from(scanStatus)
    .where(
      and(eq(scanStatus.userName, userName), eq(scanStatus.scanType, scanType)),
    )
    .orderBy(desc(scanStatus.startTime))
    .limit(1)
    .get();

  return record ? (record as ScanStatusRecord) : null;
}

/**
 * Check if a movie already exists by URL to avoid duplicates.
 */
export function movieExistsByUrl(url: string): boolean {
  const result = db
    .select({ id: localMovies.id })
    .from(localMovies)
    .where(eq(localMovies.url, url))
    .limit(1)
    .get();

  return !!result;
}

/**
 * True when a row exists for this URL but has no TMDB metadata yet,
 * or stored credits are missing TMDB fields (e.g. credit_id).
 * Lets a later scan retry enrichment without duplicating the movie.
 */
export function isMissingTmdbMetadata(url: string): boolean {
  const result = db
    .select({
      id: localMovies.id,
      overview: localMovies.overview,
      posterPath: localMovies.posterPath,
      imdbId: localMovies.imdbId,
    })
    .from(localMovies)
    .where(eq(localMovies.url, url))
    .limit(1)
    .get();

  if (!result) {
    return false;
  }

  if (!result.overview && !result.posterPath && !result.imdbId) {
    return true;
  }

  const incompleteCast = db
    .select({ id: localMovieCast.id })
    .from(localMovieCast)
    .where(
      and(
        eq(localMovieCast.localMovieId, result.id),
        isNull(localMovieCast.creditId),
      ),
    )
    .limit(1)
    .get();

  return !!incompleteCast;
}

/**
 * Delete movies by relative media URLs.
 * Child rows are removed via FK cascade.
 */
export function deleteMoviesByUrls(urls: string[]): number {
  if (urls.length === 0) {
    return 0;
  }

  const result = db
    .delete(localMovies)
    .where(inArray(localMovies.url, urls))
    .run();

  return result.changes;
}

/**
 * Movies that were imported from a persisted metadata JSON path.
 * Rows with a null metadata_file are legacy and are left alone.
 */
export function listMoviesWithMetadataFile(): MovieMetadataFileRef[] {
  const rows = db
    .select({
      id: localMovies.id,
      url: localMovies.url,
      metadataFile: localMovies.metadataFile,
    })
    .from(localMovies)
    .where(isNotNull(localMovies.metadataFile))
    .all();

  return rows.filter(
    (row): row is MovieMetadataFileRef =>
      typeof row.metadataFile === "string" && row.metadataFile.length > 0,
  );
}

export function findMovieIdByMetadataFile(
  metadataFile: string,
): number | null {
  const record = db
    .select({ id: localMovies.id })
    .from(localMovies)
    .where(eq(localMovies.metadataFile, metadataFile))
    .limit(1)
    .get();

  return record?.id ?? null;
}

export function deleteMoviesByMetadataFile(metadataFile: string): number {
  const result = db
    .delete(localMovies)
    .where(eq(localMovies.metadataFile, metadataFile))
    .run();

  return result.changes;
}

/**
 * Attach a metadata JSON path to an existing row that does not have one yet.
 */
export function setMetadataFileIfMissing(
  url: string,
  metadataFile: string,
): void {
  db.update(localMovies)
    .set({ metadataFile })
    .where(and(eq(localMovies.url, url), isNull(localMovies.metadataFile)))
    .run();
}

/**
 * Insert a discovered movie into the database.
 * Returns the inserted movie record with ID.
 */
export function insertDiscoveredMovie(movieData: DiscoveredMovieData): number {
  const record = db
    .insert(localMovies)
    .values(toMovieValues(movieData))
    .returning({ id: localMovies.id })
    .get();

  return (record as { id: number }).id;
}

/**
 * Refresh a movie and its metadata relations without replacing the movie row.
 * Keeping the stable movie ID preserves playback_progress references.
 */
export function refreshDiscoveredMovie(
  movieData: DiscoveredMovieData,
): number {
  return db.transaction((tx) => {
    const existingByMetadata = movieData.metadataFile
      ? tx
          .select({ id: localMovies.id })
          .from(localMovies)
          .where(eq(localMovies.metadataFile, movieData.metadataFile))
          .limit(1)
          .get()
      : undefined;
    const existing =
      existingByMetadata ??
      tx
        .select({ id: localMovies.id })
        .from(localMovies)
        .where(eq(localMovies.url, movieData.url))
        .limit(1)
        .get();

    if (!existing) {
      throw new Error(`Movie not found for metadata refresh: ${movieData.url}`);
    }

    const movieId = existing.id;
    tx.delete(localMovieCast)
      .where(eq(localMovieCast.localMovieId, movieId))
      .run();
    tx.delete(localMovieCrew)
      .where(eq(localMovieCrew.localMovieId, movieId))
      .run();
    tx.delete(localMovieGenres)
      .where(eq(localMovieGenres.localMovieId, movieId))
      .run();
    tx.delete(localMovieExtras)
      .where(eq(localMovieExtras.localMovieId, movieId))
      .run();
    tx.delete(localMovieTrailers)
      .where(eq(localMovieTrailers.localMovieId, movieId))
      .run();
    tx.update(localMovies)
      .set(toMovieValues(movieData))
      .where(eq(localMovies.id, movieId))
      .run();

    return movieId;
  });
}

/**
 * Insert extras for a movie from metadata JSON.
 */
export function insertMovieExtras(
  movieId: number,
  extras: Array<{
    title: string;
    runtime: string;
    url: string;
  }>,
): void {
  if (extras.length === 0) {
    return;
  }

  db.insert(localMovieExtras)
    .values(
      extras.map((extra) => ({
        localMovieId: movieId,
        title: extra.title,
        runtime: extra.runtime,
        url: extra.url,
      })),
    )
    .run();
}

/**
 * Insert cast for a movie (from TMDB data).
 */
export function insertMovieCast(
  movieId: number,
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

  db.insert(localMovieCast)
    .values(
      cast.map((c) => ({
        localMovieId: movieId,
        adult: c.adult,
        castId: c.castId,
        character: c.character,
        creditId: c.creditId,
        gender: c.gender,
        personId: c.personId,
        knownForDepartment: c.knownForDepartment,
        name: c.name,
        order: c.order,
        originalName: c.originalName,
        popularity: c.popularity,
        profilePath: c.profilePath,
      })),
    )
    .run();
}

/**
 * Insert crew for a movie (from TMDB data).
 */
export function insertMovieCrew(
  movieId: number,
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

  db.insert(localMovieCrew)
    .values(
      crew.map((c) => ({
        localMovieId: movieId,
        adult: c.adult,
        creditId: c.creditId,
        department: c.department,
        gender: c.gender,
        personId: c.personId,
        job: c.job,
        knownForDepartment: c.knownForDepartment,
        name: c.name,
        originalName: c.originalName,
        popularity: c.popularity,
        profilePath: c.profilePath,
      })),
    )
    .run();
}

/**
 * Insert genres for a movie (from TMDB data).
 */
export function insertMovieGenres(
  movieId: number,
  genres: Array<{
    id: number;
    name: string;
  }>,
): void {
  if (genres.length === 0) {
    return;
  }

  db.insert(localMovieGenres)
    .values(
      genres.map((g) => ({
        localMovieId: movieId,
        genreId: g.id,
        name: g.name,
      })),
    )
    .run();
}

/**
 * Insert trailer for a movie (from TMDB data).
 * Only the first official trailer is stored.
 */
export function insertMovieTrailer(
  movieId: number,
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

  db.insert(localMovieTrailers)
    .values({
      localMovieId: movieId,
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
