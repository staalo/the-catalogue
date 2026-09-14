import { apiGet, apiPut } from '@/lib/api';

export type MoviePlaybackProgress = {
  movieId: number;
  progress: number;
  updatedAt: string;
};

type MoviePlaybackProgressResult = {
  items: MoviePlaybackProgress[];
};

const movieUpdateQueues = new Map<number, Promise<void>>();

export async function getMoviePlaybackProgress(): Promise<MoviePlaybackProgress[]> {
  const result = await apiGet<MoviePlaybackProgressResult>('/api/playback/movies');
  return result.items;
}

function updateMoviePlaybackProgress(
  movieId: number,
  progress: number,
): Promise<MoviePlaybackProgress> {
  return apiPut<MoviePlaybackProgress>(`/api/playback/movies/${movieId}`, {
    progress,
  });
}

export function queueMoviePlaybackProgressUpdate(
  movieId: number,
  progress: number,
): Promise<void> {
  const previous = movieUpdateQueues.get(movieId) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(async () => {
      await updateMoviePlaybackProgress(movieId, progress);
    });

  movieUpdateQueues.set(movieId, queued);
  void queued
    .finally(() => {
      if (movieUpdateQueues.get(movieId) === queued) {
        movieUpdateQueues.delete(movieId);
      }
    })
    .catch(() => undefined);

  return queued;
}
