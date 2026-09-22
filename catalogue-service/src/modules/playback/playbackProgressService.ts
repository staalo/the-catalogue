import { getMovieById } from "../../infra/db/repositories/localMovieRepository.js";
import {
  listMoviePlaybackProgress,
  upsertMoviePlaybackProgress,
  type MoviePlaybackProgress,
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

  const movie = await getMovieById(movieId);
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
