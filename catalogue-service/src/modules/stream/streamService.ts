import path from "node:path";
import fs from "node:fs";
import { getMovieById } from "../../infra/db/repositories/localMovieRepository.js";
import { getMediaPaths } from "../../infra/db/repositories/localMediaRepository.js";
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
 * Get the authorized movies path for a user.
 * Returns null if user has no media configured or path doesn't exist.
 */
async function getAuthorizedMoviesPath(
  userName: string,
): Promise<string | null> {
  const localMedia = getMediaPaths(userName);

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
function tryResolveFile(
  filePath: string,
  moviesPath: string,
): [StreamStatus, StreamFile | null] {
  // Check path is under authorized directory
  if (!isPathUnderDirectory(filePath, moviesPath)) {
    return [StreamStatus.Forbidden, null];
  }

  const fullPath = path.resolve(filePath);

  // Check file exists
  if (!fs.existsSync(fullPath)) {
    return [StreamStatus.NotFound, null];
  }

  // Check content type is allowed
  const contentType = getContentType(fullPath);
  if (!contentType) {
    return [StreamStatus.Forbidden, null];
  }

  return [StreamStatus.Ok, { filePath: fullPath, contentType }];
}

/**
 * Get a movie stream.
 * Returns the movie file path and content type, or an error status.
 */
export async function tryGetMovieStream(
  userName: string,
  movieId: number,
): Promise<[StreamStatus, StreamFile | null]> {
  const moviesPath = await getAuthorizedMoviesPath(userName);
  if (!moviesPath) {
    return [StreamStatus.Forbidden, null];
  }

  const movie = await getMovieById(movieId);
  if (!movie) {
    return [StreamStatus.NotFound, null];
  }

  return tryResolveFile(movie.url, moviesPath);
}

/**
 * Get a movie asset stream (e.g., HLS playlist, subtitle file).
 */
export async function tryGetMovieAssetStream(
  userName: string,
  movieId: number,
  relativePath: string,
): Promise<[StreamStatus, StreamFile | null]> {
  const moviesPath = await getAuthorizedMoviesPath(userName);
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

  return tryResolveFile(assetPath, moviesPath);
}

/**
 * Get an extra stream.
 */
export async function tryGetExtraStream(
  userName: string,
  movieId: number,
  extraId: number,
): Promise<[StreamStatus, StreamFile | null]> {
  const moviesPath = await getAuthorizedMoviesPath(userName);
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

  return tryResolveFile(extra.url, moviesPath);
}

/**
 * Get an extra asset stream (e.g., HLS playlist for an extra).
 */
export async function tryGetExtraAssetStream(
  userName: string,
  movieId: number,
  extraId: number,
  relativePath: string,
): Promise<[StreamStatus, StreamFile | null]> {
  const moviesPath = await getAuthorizedMoviesPath(userName);
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

  return tryResolveFile(assetPath, moviesPath);
}
