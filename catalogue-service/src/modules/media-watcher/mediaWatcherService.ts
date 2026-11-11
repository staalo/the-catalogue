/**
 * Media Watcher Service - scans media directories and enriches with TMDB metadata.
 */

import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import chokidar from "chokidar";
import { db } from "../../infra/db/client.js";
import { scanStatus } from "../../infra/db/schema.js";
import { eq } from "drizzle-orm";
import * as mediaWatcherRepo from "../../infra/db/repositories/mediaWatcherRepository.js";
import * as seriesRepo from "../../infra/db/repositories/localSeriesRepository.js";
import { getMediaPaths } from "../media-paths/mediaPathService.js";
import {
  applyTvSeasonDetails,
  manifestSeasonNumbers,
  parseTvManifest,
  type ParsedTvNode,
} from "../tv/parseTvManifest.js";
import {
  searchMovieOnTmdb,
  searchTvOnTmdb,
  fetchTvSeasonDetails,
  extractTitleFromFilename,
  extractYearFromFilename,
  mapTmdbCastMember,
  mapTmdbCrewMember,
  mapTmdbCreator,
} from "../tmdb/tmdbClientService.js";
import type { DiscoveredSeriesData } from "../../infra/db/repositories/localSeriesRepository.js";

const WATCHER_EXTENSION = ".json";
const RECENT_EVENT_WINDOW_MS = 15000;
const STARTUP_SCAN_OWNER = "system";

const activeWatchers = new Map<string, chokidar.FSWatcher>();
const recentEvents = new Map<string, number>();

interface ScanResult {
  scanId: number;
  success: boolean;
  message: string;
  stats: {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    errorCount: number;
  };
}

interface LegacyMovieJson {
  DVD?: {
    Title?: string;
    Year?: number;
    Runtime?: number | string;
    File?: string;
  };
  Extras?: Record<
    string,
    {
      Title?: string;
      Runtime?: string;
      File?: string;
    }
  >;
}

interface ParsedMetadata {
  title: string;
  year?: number;
  runtime?: number;
  movieUrl: string;
  extras: Array<{
    title: string;
    runtime: string;
    url: string;
  }>;
}

/**
 * Scan a media directory for movie files and enrich with TMDB metadata.
 * Runs asynchronously; progress can be checked via getScanStatus().
 */
export async function scanMediaDirectory(
  userName: string,
  scanType: "movies" | "tv" = "movies",
): Promise<ScanResult> {
  const mediaPaths = getMediaPaths();

  const mediaPath =
    scanType === "movies" ? mediaPaths.moviesPath : mediaPaths.tvPath;

  if (!mediaPath) {
    return {
      scanId: 0,
      success: false,
      message: `No shared ${scanType} path is configured`,
      stats: {
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        errorCount: 0,
      },
    };
  }

  if (!(await pathExists(mediaPath))) {
    return {
      scanId: 0,
      success: false,
      message: `Media path does not exist: ${mediaPath}`,
      stats: {
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        errorCount: 0,
      },
    };
  }

  const scanRecord = mediaWatcherRepo.createScanRecord(userName, scanType);

  void (async () => {
    try {
      await performScan(scanRecord.id, mediaPath);
      mediaWatcherRepo.updateScanRecord(scanRecord.id, {
        status: "completed",
        endTime: new Date().toISOString(),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error("Scan failed:", errorMsg);
      mediaWatcherRepo.updateScanRecord(scanRecord.id, {
        status: "failed",
        endTime: new Date().toISOString(),
        errorLog: JSON.stringify([
          { error: "Scan aborted", message: errorMsg },
        ]),
      });
    }
  })();

  return {
    scanId: scanRecord.id,
    success: true,
    message: "Scan started in background",
    stats: {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errorCount: 0,
    },
  };
}

/**
 * Startup entrypoint:
 * 1) mark scans left running by a previous process as failed
 * 2) scan configured directories
 * 3) start chokidar watchers for JSON metadata changes
 */
export async function setupFileWatchers(): Promise<void> {
  const interrupted = mediaWatcherRepo.failInterruptedScans();
  if (interrupted > 0) {
    console.log(
      `[MediaWatcher] Marked ${interrupted} interrupted scan(s) as failed.`,
    );
  }

  const mediaPaths = getMediaPaths();

  if (mediaPaths.moviesPath && (await pathExists(mediaPaths.moviesPath))) {
    void scanMediaDirectory(STARTUP_SCAN_OWNER, "movies");
    setupWatcherForDirectory(mediaPaths.moviesPath);
  }

  if (mediaPaths.tvPath && (await pathExists(mediaPaths.tvPath))) {
    void scanMediaDirectory(STARTUP_SCAN_OWNER, "tv");
    setupWatcherForDirectory(mediaPaths.tvPath);
  }

  if (!mediaPaths.moviesPath && !mediaPaths.tvPath) {
    console.warn(
      "[MediaWatcher] No shared media paths configured. Set MOVIES_PATH and/or TV_PATH in .env.",
    );
  }
}

/** Stop all watchers when the app shuts down. */
export async function stopAllWatchers(): Promise<void> {
  for (const watcher of activeWatchers.values()) {
    await watcher.close();
  }
  activeWatchers.clear();
}

/** Get the status of a scan by ID. */
export function getScanStatus(
  scanId: number,
): mediaWatcherRepo.ScanStatusRecord | null {
  const record = db
    .select()
    .from(scanStatus)
    .where(eq(scanStatus.id, scanId))
    .limit(1)
    .get();

  return record ? (record as mediaWatcherRepo.ScanStatusRecord) : null;
}

/** Get the latest scan status for a user. */
export function getLatestScanStatus(
  userName: string,
  scanType: "movies" | "tv" = "movies",
): mediaWatcherRepo.ScanStatusRecord | null {
  return mediaWatcherRepo.getLatestScanForUser(userName, scanType);
}

function setupWatcherForDirectory(dirPath: string): void {
  if (activeWatchers.has(dirPath)) {
    return;
  }

  const watcher = chokidar.watch(path.join(dirPath, `*${WATCHER_EXTENSION}`), {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  watcher
    .on("add", (filePath: string) => onJsonMetadataChanged(filePath, "add"))
    .on("change", (filePath: string) =>
      onJsonMetadataChanged(filePath, "change"),
    )
    .on("unlink", (filePath: string) => onJsonMetadataDeleted(filePath))
    .on("error", (error: Error) => {
      console.error(`[MediaWatcher] Watcher error for ${dirPath}:`, error);
    });

  activeWatchers.set(dirPath, watcher);
}

async function onJsonMetadataChanged(
  filePath: string,
  eventType: "add" | "change",
): Promise<void> {
  if (!isTopLevelMetadataFile(filePath)) {
    return;
  }

  if (shouldIgnoreWatcherEvent(filePath)) {
    return;
  }

  await processJsonMetadataFile(filePath, eventType);
}

async function onJsonMetadataDeleted(filePath: string): Promise<void> {
  if (!isTopLevelMetadataFile(filePath)) {
    return;
  }

  const metadataFile = normalizeMetadataFilePath(filePath);
  if (resolveLibraryKind(filePath) === "tv") {
    const deletedRows = seriesRepo.deleteSeriesByMetadataFile(metadataFile);
    console.log(
      `[MediaWatcher] TV metadata file deleted: ${filePath}. Removed ${deletedRows} series row(s).`,
    );
    return;
  }

  const deletedRows = mediaWatcherRepo.deleteMoviesByMetadataFile(metadataFile);

  console.log(
    `[MediaWatcher] Metadata file deleted: ${filePath}. Removed ${deletedRows} movie row(s).`,
  );
}

function shouldIgnoreWatcherEvent(filePath: string): boolean {
  const key = toFileKey(filePath);
  const now = Date.now();
  const lastEventTime = recentEvents.get(key);

  if (lastEventTime && now - lastEventTime < RECENT_EVENT_WINDOW_MS) {
    return true;
  }

  recentEvents.set(key, now);

  for (const [eventKey, timestamp] of recentEvents.entries()) {
    if (now - timestamp > RECENT_EVENT_WINDOW_MS) {
      recentEvents.delete(eventKey);
    }
  }

  return false;
}

async function processTvMetadataFile(
  jsonFilePath: string,
  eventType: "add" | "change",
  libraryRoot?: string,
): Promise<void> {
  const metadataFile = normalizeMetadataFilePath(jsonFilePath);

  if (eventType === "add") {
    const existingId = seriesRepo.findSeriesIdByMetadataFile(metadataFile);
    if (existingId != null && !seriesRepo.isSeriesMissingTmdbById(existingId)) {
      return;
    }
  }

  try {
    const jsonContent = await readFile(jsonFilePath, "utf-8");
    const metadata = JSON.parse(jsonContent) as unknown;
    const watcherRoot =
      findBestWatcherRoot(jsonFilePath) ??
      libraryRoot ??
      path.dirname(jsonFilePath);
    const parsed = parseTvManifest(metadata, watcherRoot);

    if (!parsed) {
      console.warn(
        `[MediaWatcher] Invalid TV metadata structure in: ${jsonFilePath}`,
      );
      return;
    }

    await warnMissingTvFiles(parsed.nodes, jsonFilePath);

    const existingId = seriesRepo.findSeriesIdByMetadataFile(metadataFile);
    const shouldRefresh =
      eventType === "change" ||
      (existingId != null && seriesRepo.isSeriesMissingTmdbById(existingId));

    if (existingId != null && !shouldRefresh) {
      return;
    }

    const tmdbResult = await searchTvOnTmdb(parsed.title, parsed.year);
    if (tmdbResult) {
      for (const seasonNumber of manifestSeasonNumbers(parsed.nodes)) {
        const episodes = await fetchTvSeasonDetails(
          tmdbResult.id,
          seasonNumber,
        );
        applyTvSeasonDetails(parsed.nodes, seasonNumber, episodes);
      }
    }

    const seriesData: DiscoveredSeriesData = {
      title: tmdbResult?.name || parsed.title,
      runtime: tmdbResult?.episode_run_time?.[0] ?? 0,
      adult: tmdbResult?.adult ?? false,
      hasExtras: parsed.hasExtras,
      metadataFile,
    };

    if (typeof parsed.year === "number") seriesData.year = parsed.year;
    if (tmdbResult) seriesData.tmdbId = tmdbResult.id;
    if (tmdbResult?.original_name) {
      seriesData.originalTitle = tmdbResult.original_name;
    }
    if (tmdbResult?.overview) seriesData.overview = tmdbResult.overview;
    if (tmdbResult?.first_air_date) {
      seriesData.releaseDate = tmdbResult.first_air_date;
    }
    if (tmdbResult?.popularity) seriesData.popularity = tmdbResult.popularity;
    if (tmdbResult?.vote_average) {
      seriesData.voteAverage = tmdbResult.vote_average;
    }
    if (tmdbResult?.vote_count) seriesData.voteCount = tmdbResult.vote_count;
    if (tmdbResult?.poster_path) seriesData.posterPath = tmdbResult.poster_path;
    if (tmdbResult?.backdrop_path) {
      seriesData.backdropPath = tmdbResult.backdrop_path;
    }
    if (tmdbResult?.homepage) seriesData.homepage = tmdbResult.homepage;
    if (tmdbResult?.original_language) {
      seriesData.originalLanguage = tmdbResult.original_language;
    }
    if (tmdbResult?.tagline) seriesData.tagline = tmdbResult.tagline;

    const seriesId =
      shouldRefresh && existingId != null
        ? seriesRepo.refreshDiscoveredSeries(seriesData, parsed.nodes)
        : seriesRepo.insertDiscoveredSeries(seriesData, parsed.nodes);

    if (tmdbResult?.created_by && tmdbResult.created_by.length > 0) {
      seriesRepo.insertSeriesCrew(
        seriesId,
        tmdbResult.created_by.map(mapTmdbCreator),
      );
    }

    if (tmdbResult?.genres) {
      seriesRepo.insertSeriesGenres(seriesId, tmdbResult.genres);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[MediaWatcher] Error processing TV JSON file ${jsonFilePath}:`,
      errorMsg,
    );
  }
}

async function warnMissingTvFiles(
  nodes: ParsedTvNode[],
  source: string,
): Promise<void> {
  for (const node of nodes) {
    if (node.filePath && !(await pathExists(node.filePath))) {
      console.warn(
        `[MediaWatcher] TV file from JSON does not exist: ${node.filePath} (source: ${source})`,
      );
    }
    await warnMissingTvFiles(node.children, source);
  }
}

async function processJsonMetadataFile(
  jsonFilePath: string,
  eventType: "add" | "change",
  libraryRoot?: string,
): Promise<void> {
  if (!isTopLevelMetadataFile(jsonFilePath, libraryRoot)) {
    return;
  }

  if (resolveLibraryKind(jsonFilePath, libraryRoot) === "tv") {
    await processTvMetadataFile(jsonFilePath, eventType, libraryRoot);
    return;
  }

  const metadataFile = normalizeMetadataFilePath(jsonFilePath);

  // Rescan/startup: skip the JSON and video-file I/O when this metadata
  // path is already catalogued and TMDB enrichment is complete.
  if (eventType === "add") {
    const existingId = mediaWatcherRepo.findMovieIdByMetadataFile(metadataFile);
    if (
      existingId != null &&
      !mediaWatcherRepo.isMissingTmdbMetadataById(existingId)
    ) {
      return;
    }
  }

  try {
    const jsonContent = await readFile(jsonFilePath, "utf-8");
    const metadata = JSON.parse(jsonContent) as LegacyMovieJson;

    const watcherRoot =
      findBestWatcherRoot(jsonFilePath) ??
      libraryRoot ??
      path.dirname(jsonFilePath);
    const parsed = parseLegacyMovieJson(metadata, watcherRoot);

    if (!parsed) {
      console.warn(
        `[MediaWatcher] Invalid metadata structure in: ${jsonFilePath}`,
      );
      return;
    }

    const existingByMetadata =
      mediaWatcherRepo.findMovieIdByMetadataFile(metadataFile);
    const alreadyExists =
      existingByMetadata != null ||
      mediaWatcherRepo.movieExistsByUrl(parsed.movieUrl);
    const urlChanged =
      existingByMetadata != null &&
      !mediaWatcherRepo.movieExistsByUrl(parsed.movieUrl);
    const shouldRefresh =
      eventType === "change" ||
      urlChanged ||
      (alreadyExists &&
        mediaWatcherRepo.isMissingTmdbMetadata(parsed.movieUrl));

    if (alreadyExists && !shouldRefresh) {
      mediaWatcherRepo.setMetadataFileIfMissing(parsed.movieUrl, metadataFile);
      return;
    }

    if (!(await pathExists(parsed.movieUrl))) {
      console.warn(
        `[MediaWatcher] Movie file from JSON does not exist: ${parsed.movieUrl} (source: ${jsonFilePath})`,
      );
    }

    const tmdbResult = await searchMovieOnTmdb(parsed.title, parsed.year);

    const movieData: {
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
      metadataFile?: string;
    } = {
      title: tmdbResult?.title ?? parsed.title,
      url: parsed.movieUrl,
      runtime: tmdbResult?.runtime ?? parsed.runtime ?? 0,
      adult: tmdbResult?.adult ?? false,
      hasExtras: parsed.extras.length > 0,
      metadataFile,
    };

    if (tmdbResult?.original_title)
      movieData.originalTitle = tmdbResult.original_title;
    if (tmdbResult?.overview) movieData.overview = tmdbResult.overview;
    if (tmdbResult?.release_date)
      movieData.releaseDate = tmdbResult.release_date;
    if (tmdbResult?.popularity) movieData.popularity = tmdbResult.popularity;
    if (tmdbResult?.vote_average)
      movieData.voteAverage = tmdbResult.vote_average;
    if (tmdbResult?.vote_count) movieData.voteCount = tmdbResult.vote_count;
    if (tmdbResult?.poster_path) movieData.posterPath = tmdbResult.poster_path;
    if (tmdbResult?.backdrop_path)
      movieData.backdropPath = tmdbResult.backdrop_path;
    if (tmdbResult?.homepage) movieData.homepage = tmdbResult.homepage;
    if (tmdbResult?.imdb_id) movieData.imdbId = tmdbResult.imdb_id;
    if (tmdbResult?.original_language)
      movieData.originalLanguage = tmdbResult.original_language;
    if (tmdbResult?.tagline) movieData.tagline = tmdbResult.tagline;

    const movieId =
      shouldRefresh && alreadyExists
        ? mediaWatcherRepo.refreshDiscoveredMovie(movieData)
        : mediaWatcherRepo.insertDiscoveredMovie(movieData);

    if (parsed.extras.length > 0) {
      mediaWatcherRepo.insertMovieExtras(movieId, parsed.extras);
    }

    if (tmdbResult?.credits?.cast) {
      mediaWatcherRepo.insertMovieCast(
        movieId,
        tmdbResult.credits.cast.map(mapTmdbCastMember),
      );
    }

    if (tmdbResult?.credits?.crew) {
      mediaWatcherRepo.insertMovieCrew(
        movieId,
        tmdbResult.credits.crew.map(mapTmdbCrewMember),
      );
    }

    if (tmdbResult?.genres) {
      mediaWatcherRepo.insertMovieGenres(movieId, tmdbResult.genres);
    }

    const trailer = tmdbResult?.videos?.results?.find(
      (v) => v.official && v.type === "Trailer" && v.site === "YouTube",
    );

    if (trailer) {
      mediaWatcherRepo.insertMovieTrailer(movieId, {
        key: trailer.key,
        name: trailer.name,
        site: trailer.site,
        type: trailer.type,
        official: trailer.official,
        publishedAt: trailer.published_at,
        iso6391: trailer.iso_639_1,
        iso31661: trailer.iso_3166_1,
        size: trailer.size,
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(
      `[MediaWatcher] Error processing JSON file ${jsonFilePath}:`,
      errorMsg,
    );
  }
}

function parseLegacyMovieJson(
  metadata: LegacyMovieJson,
  watcherRoot: string,
): ParsedMetadata | null {
  const dvd = metadata.DVD;
  if (!dvd?.File) {
    return null;
  }

  const resolvedMoviePath = resolveStoragePath(watcherRoot, dvd.File);
  const movieFileName = path.basename(resolvedMoviePath);

  const title =
    (typeof dvd.Title === "string" ? dvd.Title.trim() : "") ||
    extractTitleFromFilename(movieFileName);

  if (!title || title.length < 2) {
    return null;
  }

  const year =
    typeof dvd.Year === "number"
      ? dvd.Year
      : extractYearFromFilename(movieFileName);

  const runtime = typeof dvd.Runtime === "number" ? dvd.Runtime : undefined;

  const extras: ParsedMetadata["extras"] = [];

  if (metadata.Extras) {
    for (const extra of Object.values(metadata.Extras)) {
      if (!extra?.File) {
        continue;
      }

      const extraResolvedPath = resolveStoragePath(watcherRoot, extra.File);
      const extraFileName = path.basename(extraResolvedPath);
      const extraTitle =
        (typeof extra.Title === "string" ? extra.Title.trim() : "") ||
        extractTitleFromFilename(extraFileName);

      extras.push({
        title: extraTitle || "Extra",
        runtime: typeof extra.Runtime === "string" ? extra.Runtime : "",
        url: extraResolvedPath,
      });
    }
  }

  const parsed: ParsedMetadata = {
    title,
    movieUrl: resolvedMoviePath,
    extras,
  };

  if (typeof year === "number") {
    parsed.year = year;
  }

  if (typeof runtime === "number") {
    parsed.runtime = runtime;
  }

  return parsed;
}

function resolveStoragePath(watcherRoot: string, fileFromJson: string): string {
  const normalizedRelative = fileFromJson.replace(/\\/g, "/");
  const absolutePath = path.resolve(watcherRoot, normalizedRelative);
  return absolutePath.replace(/\\/g, "/");
}

function resolveLibraryKind(
  filePath: string,
  libraryRoot?: string,
): "movies" | "tv" {
  const mediaPaths = getMediaPaths();
  const candidates: Array<{ kind: "movies" | "tv"; root: string }> = [];

  const consider = (kind: "movies" | "tv", root: string | null): void => {
    if (!root) {
      return;
    }
    if (libraryRoot && samePath(libraryRoot, root)) {
      candidates.push({ kind, root });
      return;
    }
    if (samePath(root, filePath) || isPathInsideRoot(root, filePath)) {
      candidates.push({ kind, root });
    }
  };

  consider("movies", mediaPaths.moviesPath);
  consider("tv", mediaPaths.tvPath);
  candidates.sort((a, b) => b.root.length - a.root.length);
  return candidates[0]?.kind ?? "movies";
}

function findBestWatcherRoot(targetPath: string): string | null {
  const candidate = Array.from(activeWatchers.keys())
    .filter(
      (root) =>
        isPathInsideRoot(root, targetPath) || samePath(root, targetPath),
    )
    .sort((a, b) => b.length - a.length)[0];

  return candidate ?? null;
}

function samePath(a: string, b: string): boolean {
  const ra = path.resolve(a);
  const rb = path.resolve(b);

  if (process.platform === "win32") {
    return ra.toLowerCase() === rb.toLowerCase();
  }

  return ra === rb;
}

function normalizeMetadataFilePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function isTopLevelMetadataFile(
  filePath: string,
  libraryRoot?: string,
): boolean {
  if (!filePath.toLowerCase().endsWith(WATCHER_EXTENSION)) {
    return false;
  }

  const parent = path.resolve(path.dirname(filePath));
  if (libraryRoot) {
    return samePath(parent, libraryRoot);
  }

  return Array.from(activeWatchers.keys()).some((root) =>
    samePath(root, parent),
  );
}

function isMetadataUnderLibrary(
  metadataFile: string,
  libraryRoot: string,
): boolean {
  return samePath(path.dirname(metadataFile), libraryRoot);
}

async function reconcileMissingSeriesMetadataFiles(
  mediaPath: string,
): Promise<number> {
  let removed = 0;

  for (const series of seriesRepo.listSeriesWithMetadataFile()) {
    if (!isMetadataUnderLibrary(series.metadataFile, mediaPath)) {
      continue;
    }

    if (!(await pathExists(series.metadataFile))) {
      removed += seriesRepo.deleteSeriesByMetadataFile(series.metadataFile);
    }

    await yieldToEventLoop();
  }

  return removed;
}

async function reconcileMissingMetadataFiles(
  mediaPath: string,
): Promise<number> {
  let removed = 0;

  for (const movie of mediaWatcherRepo.listMoviesWithMetadataFile()) {
    if (!isMetadataUnderLibrary(movie.metadataFile, mediaPath)) {
      continue;
    }

    if (!(await pathExists(movie.metadataFile))) {
      removed += mediaWatcherRepo.deleteMoviesByMetadataFile(
        movie.metadataFile,
      );
    }

    await yieldToEventLoop();
  }

  return removed;
}

function isPathInsideRoot(root: string, targetPath: string): boolean {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(targetPath);

  const rootForCompare =
    process.platform === "win32" ? resolvedRoot.toLowerCase() : resolvedRoot;
  const targetForCompare =
    process.platform === "win32"
      ? resolvedTarget.toLowerCase()
      : resolvedTarget;

  const relative = path.relative(rootForCompare, targetForCompare);
  return !relative.startsWith("..") && !path.isAbsolute(relative);
}

function toFileKey(filePath: string): string {
  const resolved = path.resolve(filePath);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isJsonMetadataFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith(WATCHER_EXTENSION);
}

/**
 * Collect JSON metadata files in a library root.
 * Only the top-level folder is considered; nested JSON is ignored.
 */
export async function collectJsonMetadataFiles(
  mediaPath: string,
): Promise<string[]> {
  const entries = await readdir(mediaPath);
  return entries.filter(
    (file) =>
      typeof file === "string" &&
      isJsonMetadataFile(file) &&
      !file.includes("/") &&
      !file.includes("\\"),
  );
}

async function performScan(scanId: number, mediaPath: string): Promise<void> {
  const errors: Array<{ file: string; error: string }> = [];
  let processedCount = 0;
  let skippedCount = 0;

  const jsonFiles = await collectJsonMetadataFiles(mediaPath);

  mediaWatcherRepo.updateScanRecord(scanId, {
    totalFiles: jsonFiles.length,
  });

  for (const relativeJsonPath of jsonFiles) {
    const absoluteJsonPath = path.join(mediaPath, relativeJsonPath);

    try {
      await processJsonMetadataFile(absoluteJsonPath, "add", mediaPath);
      processedCount++;

      mediaWatcherRepo.updateScanRecord(scanId, {
        processedFiles: processedCount,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      errors.push({ file: relativeJsonPath, error: errorMsg });
      skippedCount++;

      mediaWatcherRepo.updateScanRecord(scanId, {
        skippedFiles: skippedCount,
        errorCount: errors.length,
        errorLog: JSON.stringify(errors),
      });
    }

    await yieldToEventLoop();
  }

  if (resolveLibraryKind(mediaPath, mediaPath) === "tv") {
    await reconcileMissingSeriesMetadataFiles(mediaPath);
  } else {
    await reconcileMissingMetadataFiles(mediaPath);
  }
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
