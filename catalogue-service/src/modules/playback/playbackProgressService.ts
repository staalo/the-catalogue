import { getMovieById } from "../../infra/db/repositories/localMovieRepository.js";
import {
  listMoviePlaybackProgress,
  upsertMoviePlaybackProgress,
  type MoviePlaybackProgress,
} from "../../infra/db/repositories/playbackProgressRepository.js";
import {
  BadRequestError,
  NotFoundError,
} from "../../shared/errors/AppError.js";

export interface MoviePlaybackProgressResult {
  items: MoviePlaybackProgress[];
}

export function getMoviePlaybackProgress(
  userId: string,
): MoviePlaybackProgressResult {
  return { items: listMoviePlaybackProgress(userId) };
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

  const normalizedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  return upsertMoviePlaybackProgress(userId, movieId, normalizedProgress);
}
