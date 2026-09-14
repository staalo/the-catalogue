import { apiGet, apiPut } from '@/lib/api';

export type MoviePlaybackProgress = {
  movieId: number;
  progress: number;
  updatedAt: string;
};

type MoviePlaybackProgressResult = {
  items: MoviePlaybackProgress[];
};

const movieUpdateQueues = new Map<string, Promise<void>>();
let activePlaybackUser: string | null = null;
let playbackSessionGeneration = 0;

export function setPlaybackProgressSession(userName?: string): void {
  const nextUser = userName ?? null;
  if (nextUser === activePlaybackUser) {
    return;
  }

  activePlaybackUser = nextUser;
  playbackSessionGeneration += 1;
  movieUpdateQueues.clear();
}

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
  playbackUser: string,
  movieId: number,
  progress: number,
): Promise<void> {
  const queuedUser = activePlaybackUser;
  if (!queuedUser || queuedUser !== playbackUser) {
    return Promise.resolve();
  }

  const queuedGeneration = playbackSessionGeneration;
  const queueKey = `${queuedGeneration}:${movieId}`;
  const previous = movieUpdateQueues.get(queueKey) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(async () => {
      if (
        activePlaybackUser !== queuedUser
        || playbackSessionGeneration !== queuedGeneration
      ) {
        return;
      }

      await updateMoviePlaybackProgress(movieId, progress);
    });

  movieUpdateQueues.set(queueKey, queued);
  void queued
    .finally(() => {
      if (movieUpdateQueues.get(queueKey) === queued) {
        movieUpdateQueues.delete(queueKey);
      }
    })
    .catch(() => undefined);

  return queued;
}
