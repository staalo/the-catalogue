import { getMovieByIdWithExtras } from "../../infra/db/repositories/localMovieRepository.js";
import { getSeriesNodeById } from "../../infra/db/repositories/localSeriesRepository.js";
import {
  listMoviePlaybackProgress,
  listTvPlaybackProgress,
  upsertMoviePlaybackProgress,
  upsertTvPlaybackProgress,
  type MoviePlaybackProgress,
  type TvPlaybackProgress,
} from "../../infra/db/repositories/playbackProgressRepository.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../../shared/errors/AppError.js";
import { getMediaPaths } from "../media-paths/mediaPathService.js";
import { isPathUnderDirectory } from "../stream/streamPathHelpers.js";

export interface MoviePlaybackProgressResult {
  items: MoviePlaybackProgress[];
}

export function getMoviePlaybackProgress(
  userId: string,
): MoviePlaybackProgressResult {
  const moviesPath = getMediaPaths().moviesPath;
  return {
    items: moviesPath
      ? listMoviePlaybackProgress(userId, moviesPath)
      : [],
  };
}

export async function saveMoviePlaybackProgress(
  userId: string,
  movieId: number,
  progress: number,
): Promise<MoviePlaybackProgress> {
  if (!Number.isInteger(movieId) || movieId <= 0) {
    throw new BadRequestError("Movie ID must be a positive integer.");
  }

  if (!Number.isFinite(progress)) {
    throw new BadRequestError("Progress must be a finite number.");
  }

  const movie = await getMovieByIdWithExtras(movieId);
  if (!movie) {
    throw new NotFoundError("Movie not found.");
  }

  const moviesPath = getMediaPaths().moviesPath;
  if (!moviesPath || !isPathUnderDirectory(movie.url, moviesPath)) {
    throw new ForbiddenError("Movie is outside the configured library.");
  }

  const normalizedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  return upsertMoviePlaybackProgress(userId, movieId, normalizedProgress);
}

export interface TvPlaybackProgressResult {
  items: TvPlaybackProgress[];
}

export function getTvPlaybackProgress(userId: string): TvPlaybackProgressResult {
  const tvPath = getMediaPaths().tvPath;
  return {
    items: tvPath ? listTvPlaybackProgress(userId, tvPath) : [],
  };
}

export function saveTvPlaybackProgress(
  userId: string,
  nodeId: number,
  progress: number,
): TvPlaybackProgress {
  if (!Number.isInteger(nodeId) || nodeId <= 0) {
    throw new BadRequestError("Node ID must be a positive integer.");
  }

  if (!Number.isFinite(progress)) {
    throw new BadRequestError("Progress must be a finite number.");
  }

  const node = getSeriesNodeById(nodeId);
  if (!node?.metadataFile) {
    throw new NotFoundError("TV item not found.");
  }

  const tvPath = getMediaPaths().tvPath;
  if (!tvPath || !isPathUnderDirectory(node.metadataFile, tvPath)) {
    throw new NotFoundError("TV item not found.");
  }

  if (!node.url) {
    throw new BadRequestError(
      "Playback progress can only be saved for a playable episode, version, or extra.",
    );
  }

  if (!isPathUnderDirectory(node.url, tvPath)) {
    throw new ForbiddenError("TV item is outside the configured library.");
  }

  const normalizedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const saved = upsertTvPlaybackProgress(userId, nodeId, normalizedProgress);
  return {
    nodeId: saved.nodeId,
    seriesId: node.seriesId,
    progress: saved.progress,
    updatedAt: saved.updatedAt,
  };
}
