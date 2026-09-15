import { apiGet, apiRequest } from '@/lib/api';

export type MoviePlaybackProgress = {
  movieId: number;
  progress: number;
  updatedAt: string;
};

type MoviePlaybackProgressResult = {
  items: MoviePlaybackProgress[];
};

const movieUpdateQueues = new Map<string, Promise<void>>();
const PENDING_PROGRESS_KEY = 'catalogue-pending-playback-progress-v1';
const LOGOUT_FLUSH_TIMEOUT_MS = 1_500;
let activePlaybackUser: string | null = null;
let playbackSessionGeneration = 0;

type PendingProgressStore = Record<string, Record<string, number>>;

function pendingUserKey(playbackUser: string): string {
  return `user:${playbackUser}`;
}

function getPendingRecord(
  store: PendingProgressStore,
  playbackUser: string,
): Record<string, number> | undefined {
  const value = store[pendingUserKey(playbackUser)] as unknown;
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, number>
    : undefined;
}

function readPendingProgressStore(): PendingProgressStore {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(PENDING_PROGRESS_KEY) ?? '{}',
    ) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as PendingProgressStore
      : {};
  } catch {
    return {};
  }
}

function writePendingProgressStore(store: PendingProgressStore): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (Object.keys(store).length === 0) {
      window.localStorage.removeItem(PENDING_PROGRESS_KEY);
    } else {
      window.localStorage.setItem(PENDING_PROGRESS_KEY, JSON.stringify(store));
    }
  } catch {
    // Keepalive delivery can still succeed when storage is unavailable.
  }
}

function rememberPendingProgress(
  playbackUser: string,
  movieId: number,
  progress: number,
): void {
  const store = readPendingProgressStore();
  store[pendingUserKey(playbackUser)] = {
    ...(getPendingRecord(store, playbackUser) ?? {}),
    [movieId]: progress,
  };
  writePendingProgressStore(store);
}

export function getPendingPlaybackProgress(
  playbackUser: string,
): MoviePlaybackProgress[] {
  const pending =
    getPendingRecord(readPendingProgressStore(), playbackUser) ?? {};
  return Object.entries(pending)
    .map(([movieId, progress]) => ({
      movieId: Number(movieId),
      progress,
      updatedAt: '',
    }))
    .filter(
      (item) =>
        Number.isInteger(item.movieId)
        && item.movieId > 0
        && Number.isFinite(item.progress),
    );
}

export function reconcilePendingPlaybackProgress(
  playbackUser: string,
  serverItems: MoviePlaybackProgress[],
): void {
  const store = readPendingProgressStore();
  const userKey = pendingUserKey(playbackUser);
  const pending = getPendingRecord(store, playbackUser);
  if (!pending) {
    return;
  }

  for (const item of serverItems) {
    if (pending[item.movieId] === item.progress) {
      delete pending[item.movieId];
    }
  }

  if (Object.keys(pending).length === 0) {
    delete store[userKey];
  }
  writePendingProgressStore(store);
}

export function discardPendingPlaybackProgress(
  playbackUser: string,
  movieId: number,
): void {
  const store = readPendingProgressStore();
  const userKey = pendingUserKey(playbackUser);
  const pending = getPendingRecord(store, playbackUser);
  if (!pending) {
    return;
  }

  delete pending[movieId];
  if (Object.keys(pending).length === 0) {
    delete store[userKey];
  }
  writePendingProgressStore(store);
}

export function setPlaybackProgressSession(userName?: string): void {
  const nextUser = userName ?? null;
  if (nextUser === activePlaybackUser) {
    return;
  }

  activePlaybackUser = nextUser;
  playbackSessionGeneration += 1;
  movieUpdateQueues.clear();
}

export async function waitForPlaybackProgressUpdates(
  playbackUser?: string,
  timeoutMs = LOGOUT_FLUSH_TIMEOUT_MS,
): Promise<void> {
  if (!playbackUser || playbackUser !== activePlaybackUser) {
    return;
  }

  const queuePrefix = `${playbackSessionGeneration}:`;
  const pending = [...movieUpdateQueues.entries()]
    .filter(([key]) => key.startsWith(queuePrefix))
    .map(([, update]) => update);

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.allSettled(pending),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export async function getMoviePlaybackProgress(): Promise<MoviePlaybackProgress[]> {
  const result = await apiGet<MoviePlaybackProgressResult>('/api/playback/movies');
  return result.items;
}

function updateMoviePlaybackProgress(
  movieId: number,
  progress: number,
): Promise<MoviePlaybackProgress> {
  return apiRequest<MoviePlaybackProgress>(`/api/playback/movies/${movieId}`, {
    method: 'PUT',
    body: JSON.stringify({ progress }),
    keepalive: true,
  });
}

export function queueMoviePlaybackProgressUpdate(
  playbackUser: string,
  movieId: number,
  progress: number,
): Promise<void> {
  rememberPendingProgress(playbackUser, movieId, progress);

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
