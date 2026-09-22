import path from "node:path";
import { getMovieById } from "../../infra/db/repositories/localMovieRepository.js";
import { getMediaPaths } from "../media-paths/mediaPathService.js";
import {
  isPathUnderDirectory,
  getContentType,
  tryResolveAssetPath,
  fileExists,
} from "./streamPathHelpers.js";

export enum StreamStatus {
  Ok = "Ok",
  NotFound = "NotFound",
  Forbidden = "Forbidden",
}

export interface StreamFile {
  filePath: string;
  contentType: string;
}

/**
 * Get the shared authorized movies path.
 * Returns null if the path is not configured or does not exist.
 */
async function getAuthorizedMoviesPath(): Promise<string | null> {
  const localMedia = getMediaPaths();

  if (!localMedia || !localMedia.moviesPath) {
    return null;
  }

  // Check if path exists
  const exists = await fileExists(localMedia.moviesPath);
  if (!exists) {
    return null;
  }

  return path.resolve(localMedia.moviesPath);
}

/**
 * Safely resolve and validate a file for streaming.
 */
async function tryResolveFile(
  filePath: string,
  moviesPath: string,
): Promise<[StreamStatus, StreamFile | null]> {
  // Check path is under authorized directory
  if (!isPathUnderDirectory(filePath, moviesPath)) {
    return [StreamStatus.Forbidden, null];
  }

  const fullPath = path.resolve(filePath);

  // Check content type is allowed
  const contentType = getContentType(fullPath);
  if (!contentType) {
    return [StreamStatus.Forbidden, null];
  }

  if (!(await fileExists(fullPath))) {
    return [StreamStatus.NotFound, null];
  }

  return [StreamStatus.Ok, { filePath: fullPath, contentType }];
}

/**
 * Get a movie stream.
 * Returns the movie file path and content type, or an error status.
 */
export async function tryGetMovieStream(
  movieId: number,
): Promise<[StreamStatus, StreamFile | null]> {
  const moviesPath = await getAuthorizedMoviesPath();
  if (!moviesPath) {
    return [StreamStatus.Forbidden, null];
  }

  const movie = await getMovieById(movieId);
  if (!movie) {
    return [StreamStatus.NotFound, null];
  }

  return await tryResolveFile(movie.url, moviesPath);
}

/**
 * Get a movie asset stream (e.g., HLS playlist, subtitle file).
 */
export async function tryGetMovieAssetStream(
  movieId: number,
  relativePath: string,
): Promise<[StreamStatus, StreamFile | null]> {
  const moviesPath = await getAuthorizedMoviesPath();
  if (!moviesPath) {
    return [StreamStatus.Forbidden, null];
  }

  const movie = await getMovieById(movieId);
  if (!movie) {
    return [StreamStatus.NotFound, null];
  }

  const movieDirectory = path.dirname(movie.url);
  if (!movieDirectory) {
    return [StreamStatus.NotFound, null];
  }

  const assetPath = tryResolveAssetPath(
    movieDirectory,
    relativePath,
    moviesPath,
  );
  if (!assetPath) {
    return [StreamStatus.Forbidden, null];
  }

  return await tryResolveFile(assetPath, moviesPath);
}

/**
 * Get an extra stream.
 */
export async function tryGetExtraStream(
  movieId: number,
  extraId: number,
): Promise<[StreamStatus, StreamFile | null]> {
  const moviesPath = await getAuthorizedMoviesPath();
  if (!moviesPath) {
    return [StreamStatus.Forbidden, null];
  }

  const movie = await getMovieById(movieId);
  if (!movie) {
    return [StreamStatus.NotFound, null];
  }

  const extra = movie.extras.find((e) => e.id === extraId);
  if (!extra) {
    return [StreamStatus.NotFound, null];
  }

  if (!isPathUnderDirectory(extra.url, moviesPath)) {
    return [StreamStatus.Forbidden, null];
  }

  return await tryResolveFile(extra.url, moviesPath);
}

/**
 * Get an extra asset stream (e.g., HLS playlist for an extra).
 */
export async function tryGetExtraAssetStream(
  movieId: number,
  extraId: number,
  relativePath: string,
): Promise<[StreamStatus, StreamFile | null]> {
  const moviesPath = await getAuthorizedMoviesPath();
  if (!moviesPath) {
    return [StreamStatus.Forbidden, null];
  }

  const movie = await getMovieById(movieId);
  if (!movie) {
    return [StreamStatus.NotFound, null];
  }

  const extra = movie.extras.find((e) => e.id === extraId);
  if (!extra) {
    return [StreamStatus.NotFound, null];
  }

  const extraDirectory = path.dirname(extra.url);
  if (!extraDirectory) {
    return [StreamStatus.NotFound, null];
  }

  const assetPath = tryResolveAssetPath(
    extraDirectory,
    relativePath,
    moviesPath,
  );
  if (!assetPath) {
    return [StreamStatus.Forbidden, null];
  }

  return await tryResolveFile(assetPath, moviesPath);
}
