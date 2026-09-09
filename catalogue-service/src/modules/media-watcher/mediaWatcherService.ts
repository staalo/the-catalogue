/**
 * Media Watcher Service - scans media directories and enriches with TMDB metadata.
 */

import fs from "node:fs";
import path from "node:path";
import chokidar from "chokidar";
import { db } from "../../infra/db/client.js";
import { localMedia, scanStatus } from "../../infra/db/schema.js";
import { config } from "../../app/config.js";
import { eq } from "drizzle-orm";
import { getMediaPaths } from "../../infra/db/repositories/localMediaRepository.js";
import * as mediaWatcherRepo from "../../infra/db/repositories/mediaWatcherRepository.js";
import {
  searchMovieOnTmdb,
  extractTitleFromFilename,
  extractYearFromFilename,
  mapTmdbCastMember,
  mapTmdbCrewMember,
} from "../tmdb/tmdbClientService.js";

const ALLOWED_EXTENSIONS = [
  ".mp4",
  ".mkv",
  ".avi",
  ".mov",
  ".m4v",
  ".flv",
  ".webm",
  ".m3u8",
  ".ts",
];

const WATCHER_EXTENSION = ".json";
const RECENT_EVENT_WINDOW_MS = 15000;

const activeWatchers = new Map<string, chokidar.FSWatcher>();
const recentEvents = new Map<string, number>();
const importedUrlsByJson = new Map<string, string[]>();

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
  const mediaPaths = getMediaPaths(userName);
  if (!mediaPaths) {
    return {
      scanId: 0,
      success: false,
      message: "User has no media paths configured",
      stats: {
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        errorCount: 0,
      },
    };
  }

  const mediaPath =
    scanType === "movies" ? mediaPaths.moviesPath : mediaPaths.tvPath;

  if (!mediaPath) {
    return {
      scanId: 0,
      success: false,
      message: `User has no ${scanType} path configured`,
      stats: {
        totalFiles: 0,
        processedFiles: 0,
        skippedFiles: 0,
        errorCount: 0,
      },
    };
  }

  if (!fs.existsSync(mediaPath)) {
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
 * 1) scan configured directories
 * 2) start chokidar watchers for JSON metadata changes
 */
export async function setupFileWatchers(): Promise<void> {
  const records = ensureStartupMediaRecords();

  for (const record of records) {
    if (
      record.userName &&
      record.moviesPath &&
      fs.existsSync(record.moviesPath)
    ) {
      void scanMediaDirectory(record.userName, "movies");
      setupWatcherForDirectory(record.moviesPath);
    }

    if (record.userName && record.tvPath && fs.existsSync(record.tvPath)) {
      void scanMediaDirectory(record.userName, "tv");
      setupWatcherForDirectory(record.tvPath);
    }
  }
}

function ensureStartupMediaRecords(): Array<{
  id: number;
  userName: string | null;
  moviesPath: string | null;
  tvPath: string | null;
}> {
  const existing = db.select().from(localMedia).all();
  if (existing.length > 0) {
    return existing;
  }

  const moviesPath = config.defaultMoviesPath;
  const tvPath = config.defaultTvPath;

  if (!moviesPath && !tvPath) {
    console.warn(
      "[MediaWatcher] No media paths configured. Set MOVIES_PATH and/or TV_PATH in .env for first-run startup scan.",
    );
    return existing;
  }

  db.insert(localMedia)
    .values({
      userName: config.mediaBootstrapUser,
      moviesPath,
      tvPath,
    })
    .run();

  return db.select().from(localMedia).all();
}

/** Stop all watchers when the app shuts down. */
export async function stopAllWatchers(): Promise<void> {
  for (const watcher of activeWatchers.values()) {
    await watcher.close();
  }
  activeWatchers.clear();
  importedUrlsByJson.clear();
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

  const watcher = chokidar.watch(
    path.join(dirPath, "**", `*${WATCHER_EXTENSION}`),
    {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 500,
        pollInterval: 100,
      },
    },
  );

  watcher
    .on("add", (filePath: string) => {
      void onJsonMetadataChanged(filePath, "add");
    })
    .on("change", (filePath: string) => {
      void onJsonMetadataChanged(filePath, "change");
    })
    .on("unlink", (filePath: string) => {
      void onJsonMetadataDeleted(filePath);
    })
    .on("error", (error: Error) => {
      console.error(`[MediaWatcher] Watcher error for ${dirPath}:`, error);
    });

  activeWatchers.set(dirPath, watcher);
}

async function onJsonMetadataChanged(
  filePath: string,
  eventType: "add" | "change",
): Promise<void> {
  if (!filePath.toLowerCase().endsWith(WATCHER_EXTENSION)) {
    return;
  }

  if (shouldIgnoreWatcherEvent(filePath)) {
    return;
  }

  await processJsonMetadataFile(filePath, eventType);
}

async function onJsonMetadataDeleted(filePath: string): Promise<void> {
  if (!filePath.toLowerCase().endsWith(WATCHER_EXTENSION)) {
    return;
  }

  const key = toFileKey(filePath);
  const knownUrls = importedUrlsByJson.get(key);
  const fallbackUrls = buildCandidateUrlsFromJsonPath(filePath);
  const urls = knownUrls && knownUrls.length > 0 ? knownUrls : fallbackUrls;

  const deletedRows = mediaWatcherRepo.deleteMoviesByUrls(urls);
  importedUrlsByJson.delete(key);

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

async function processJsonMetadataFile(
  jsonFilePath: string,
  eventType: "add" | "change",
): Promise<void> {
  try {
    const jsonContent = fs.readFileSync(jsonFilePath, "utf-8");
    const metadata = JSON.parse(jsonContent) as LegacyMovieJson;

    const watcherRoot =
      findBestWatcherRoot(jsonFilePath) ?? path.dirname(jsonFilePath);
    const parsed = parseLegacyMovieJson(metadata, watcherRoot, jsonFilePath);

    if (!parsed) {
      console.warn(
        `[MediaWatcher] Invalid metadata structure in: ${jsonFilePath}`,
      );
      return;
    }

    const alreadyExists = mediaWatcherRepo.movieExistsByUrl(parsed.movieUrl);
    const shouldRefresh =
      eventType === "change" ||
      (alreadyExists && mediaWatcherRepo.isMissingTmdbMetadata(parsed.movieUrl));

    // On change, or when a previous scan stored the file without TMDB data,
    // remove the old row so enrichment can run again.
    if (shouldRefresh && alreadyExists) {
      mediaWatcherRepo.deleteMoviesByUrls([parsed.movieUrl]);
    } else if (alreadyExists) {
      return;
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
    } = {
      title: tmdbResult?.title ?? parsed.title,
      url: parsed.movieUrl,
      runtime: tmdbResult?.runtime ?? parsed.runtime ?? 0,
      adult: tmdbResult?.adult ?? false,
      hasExtras: parsed.extras.length > 0,
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

    const movieId = mediaWatcherRepo.insertDiscoveredMovie(movieData);

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

    const importedUrls = [
      parsed.movieUrl,
      ...parsed.extras.map((extra) => extra.url),
    ];
    importedUrlsByJson.set(toFileKey(jsonFilePath), importedUrls);
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
  jsonFilePath: string,
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

  if (!fs.existsSync(resolvedMoviePath)) {
    console.warn(
      `[MediaWatcher] Movie file from JSON does not exist: ${resolvedMoviePath} (source: ${jsonFilePath})`,
    );
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

function buildCandidateUrlsFromJsonPath(jsonFilePath: string): string[] {
  const jsonDir = path.dirname(jsonFilePath);
  const baseName = path.basename(jsonFilePath, WATCHER_EXTENSION);

  const watcherRoot = findBestWatcherRoot(jsonFilePath);

  if (!watcherRoot) {
    return ALLOWED_EXTENSIONS.map((ext) =>
      path.join(jsonDir, `${baseName}${ext}`).replace(/\\/g, "/"),
    );
  }

  const relativeDir = path.relative(watcherRoot, jsonDir);

  return ALLOWED_EXTENSIONS.map((ext) => {
    const mediaName = `${baseName}${ext}`;
    const combined = relativeDir
      ? path.join(watcherRoot, relativeDir, mediaName)
      : path.join(watcherRoot, mediaName);
    return combined.replace(/\\/g, "/");
  });
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

async function performScan(scanId: number, mediaPath: string): Promise<void> {
  const errors: Array<{ file: string; error: string }> = [];
  let processedCount = 0;
  let skippedCount = 0;

  const jsonFiles = fs
    .readdirSync(mediaPath, { recursive: true })
    .filter(
      (file) =>
        typeof file === "string" &&
        file.toLowerCase().endsWith(WATCHER_EXTENSION),
    ) as string[];

  mediaWatcherRepo.updateScanRecord(scanId, {
    totalFiles: jsonFiles.length,
  });

  for (const relativeJsonPath of jsonFiles) {
    const absoluteJsonPath = path.join(mediaPath, relativeJsonPath);

    try {
      const existedBefore = importedUrlsByJson.has(toFileKey(absoluteJsonPath));
      await processJsonMetadataFile(
        absoluteJsonPath,
        existedBefore ? "change" : "add",
      );
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
  }
}
