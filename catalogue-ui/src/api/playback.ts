import { apiGet, apiRequest } from '@/lib/api';

export type MoviePlaybackProgress = {
  movieId: number;
  progress: number;
  updatedAt: string;
};

export type TvPlaybackProgress = {
  nodeId: number;
  seriesId: number;
  progress: number;
  updatedAt: string;
};

type MoviePlaybackProgressResult = {
  items: MoviePlaybackProgress[];
};

type TvPlaybackProgressResult = {
  items: TvPlaybackProgress[];
};

const movieUpdateQueues = new Map<string, Promise<void>>();
const tvUpdateQueues = new Map<string, Promise<void>>();
const PENDING_PROGRESS_KEY = 'catalogue-pending-playback-progress-v1';
const TV_PENDING_PROGRESS_KEY = 'catalogue-pending-tv-playback-progress-v1';
const LOGOUT_FLUSH_TIMEOUT_MS = 1_500;
let activePlaybackUser: string | null = null;
let playbackSessionGeneration = 0;

type PendingProgressStore = Record<string, Record<string, number>>;

type TvPendingEntry = {
  seriesId: number;
  progress: number;
};

type TvPendingStore = Record<string, Record<string, TvPendingEntry>>;

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

function readPendingProgressStore(
  storageKey = PENDING_PROGRESS_KEY,
): PendingProgressStore {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? '{}') as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as PendingProgressStore
      : {};
  } catch {
    return {};
  }
}

function writePendingProgressStore(
  store: PendingProgressStore,
  storageKey = PENDING_PROGRESS_KEY,
): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (Object.keys(store).length === 0) {
      window.localStorage.removeItem(storageKey);
    } else {
      window.localStorage.setItem(storageKey, JSON.stringify(store));
    }
  } catch {
    // Keepalive delivery can still succeed when storage is unavailable.
  }
}

function rememberPendingProgress(
  playbackUser: string,
  itemId: number,
  progress: number,
  storageKey = PENDING_PROGRESS_KEY,
): void {
  const store = readPendingProgressStore(storageKey);
  store[pendingUserKey(playbackUser)] = {
    ...(getPendingRecord(store, playbackUser) ?? {}),
    [itemId]: progress,
  };
  writePendingProgressStore(store, storageKey);
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

function reconcilePending(
  storageKey: string,
  playbackUser: string,
  serverItems: { id: number; progress: number }[],
): void {
  const store = readPendingProgressStore(storageKey);
  const userKey = pendingUserKey(playbackUser);
  const pending = getPendingRecord(store, playbackUser);
  if (!pending) {
    return;
  }

  for (const item of serverItems) {
    if (pending[item.id] === item.progress) {
      delete pending[item.id];
    }
  }

  if (Object.keys(pending).length === 0) {
    delete store[userKey];
  }
  writePendingProgressStore(store, storageKey);
}

export function reconcilePendingPlaybackProgress(
  playbackUser: string,
  serverItems: MoviePlaybackProgress[],
): void {
  reconcilePending(
    PENDING_PROGRESS_KEY,
    playbackUser,
    serverItems.map((item) => ({ id: item.movieId, progress: item.progress })),
  );
}

export function reconcilePendingTvPlaybackProgress(
  playbackUser: string,
  serverItems: TvPlaybackProgress[],
): void {
  const store = readTvPendingStore();
  const userKey = pendingUserKey(playbackUser);
  const pending = store[userKey];
  if (!pending) {
    return;
  }

  for (const item of serverItems) {
    const entry = pending[item.nodeId];
    if (entry && entry.progress === item.progress) {
      delete pending[item.nodeId];
    }
  }

  if (Object.keys(pending).length === 0) {
    delete store[userKey];
  }
  writeTvPendingStore(store);
}

function discardPending(
  storageKey: string,
  playbackUser: string,
  itemId: number,
): void {
  const store = readPendingProgressStore(storageKey);
  const userKey = pendingUserKey(playbackUser);
  const pending = getPendingRecord(store, playbackUser);
  if (!pending) {
    return;
  }

  delete pending[itemId];
  if (Object.keys(pending).length === 0) {
    delete store[userKey];
  }
  writePendingProgressStore(store, storageKey);
}

export function discardPendingPlaybackProgress(
  playbackUser: string,
  movieId: number,
): void {
  discardPending(PENDING_PROGRESS_KEY, playbackUser, movieId);
}

export function discardPendingTvPlaybackProgress(
  playbackUser: string,
  nodeId: number,
): void {
  const store = readTvPendingStore();
  const userKey = pendingUserKey(playbackUser);
  const pending = store[userKey];
  if (!pending) {
    return;
  }

  delete pending[nodeId];
  if (Object.keys(pending).length === 0) {
    delete store[userKey];
  }
  writeTvPendingStore(store);
}

export function setPlaybackProgressSession(userName?: string): void {
  const nextUser = userName ?? null;
  if (nextUser === activePlaybackUser) {
    return;
  }

  activePlaybackUser = nextUser;
  playbackSessionGeneration += 1;
  movieUpdateQueues.clear();
  tvUpdateQueues.clear();
}

export async function waitForPlaybackProgressUpdates(
  playbackUser?: string,
  timeoutMs = LOGOUT_FLUSH_TIMEOUT_MS,
): Promise<void> {
  if (!playbackUser || playbackUser !== activePlaybackUser) {
    return;
  }

  const queuePrefix = `${playbackSessionGeneration}:`;
  const pending = [...movieUpdateQueues.entries(), ...tvUpdateQueues.entries()]
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

function queuePlaybackProgressUpdate(
  queues: Map<string, Promise<void>>,
  playbackUser: string,
  itemId: number,
  progress: number,
  send: (itemId: number, progress: number) => Promise<unknown>,
  remember: () => void,
): Promise<void> {
  remember();

  const queuedUser = activePlaybackUser;
  if (!queuedUser || queuedUser !== playbackUser) {
    return Promise.resolve();
  }

  const queuedGeneration = playbackSessionGeneration;
  const queueKey = `${queuedGeneration}:${itemId}`;
  const previous = queues.get(queueKey) ?? Promise.resolve();
  const queued = previous
    .catch(() => undefined)
    .then(async () => {
      if (
        activePlaybackUser !== queuedUser
        || playbackSessionGeneration !== queuedGeneration
      ) {
        return;
      }

      await send(itemId, progress);
    });

  queues.set(queueKey, queued);
  void queued
    .finally(() => {
      if (queues.get(queueKey) === queued) {
        queues.delete(queueKey);
      }
    })
    .catch(() => undefined);

  return queued;
}

export function queueMoviePlaybackProgressUpdate(
  playbackUser: string,
  movieId: number,
  progress: number,
): Promise<void> {
  return queuePlaybackProgressUpdate(
    movieUpdateQueues,
    playbackUser,
    movieId,
    progress,
    updateMoviePlaybackProgress,
    () => rememberPendingProgress(playbackUser, movieId, progress),
  );
}

export async function getTvPlaybackProgress(): Promise<TvPlaybackProgress[]> {
  const result = await apiGet<TvPlaybackProgressResult>('/api/playback/tv');
  return result.items;
}

export function getPendingTvPlaybackProgress(
  playbackUser: string,
): TvPlaybackProgress[] {
  const pending = readTvPendingStore()[pendingUserKey(playbackUser)] ?? {};
  return Object.entries(pending)
    .map(([nodeId, entry]) => ({
      nodeId: Number(nodeId),
      seriesId: entry.seriesId,
      progress: entry.progress,
      updatedAt: '',
    }))
    .filter(
      (item) =>
        Number.isInteger(item.nodeId)
        && item.nodeId > 0
        && Number.isInteger(item.seriesId)
        && item.seriesId > 0
        && Number.isFinite(item.progress),
    );
}

function readTvPendingStore(): TvPendingStore {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(TV_PENDING_PROGRESS_KEY) ?? '{}',
    ) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const store: TvPendingStore = {};
    for (const [userKey, record] of Object.entries(parsed)) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) {
        continue;
      }

      const entries: Record<string, TvPendingEntry> = {};
      for (const [nodeId, value] of Object.entries(record)) {
        const entry = tvPendingEntry(value);
        if (entry) {
          entries[nodeId] = entry;
        }
      }
      if (Object.keys(entries).length > 0) {
        store[userKey] = entries;
      }
    }
    return store;
  } catch {
    return {};
  }
}

function writeTvPendingStore(store: TvPendingStore): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (Object.keys(store).length === 0) {
      window.localStorage.removeItem(TV_PENDING_PROGRESS_KEY);
    } else {
      window.localStorage.setItem(TV_PENDING_PROGRESS_KEY, JSON.stringify(store));
    }
  } catch {
    // Keepalive delivery can still succeed when storage is unavailable.
  }
}

function tvPendingEntry(value: unknown): TvPendingEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const seriesId = Number((value as { seriesId?: unknown }).seriesId);
  const progress = Number((value as { progress?: unknown }).progress);
  if (!Number.isInteger(seriesId) || seriesId <= 0 || !Number.isFinite(progress)) {
    return null;
  }

  return { seriesId, progress };
}

function rememberPendingTvProgress(
  playbackUser: string,
  nodeId: number,
  seriesId: number,
  progress: number,
): void {
  if (!Number.isInteger(nodeId) || nodeId <= 0 || !Number.isInteger(seriesId) || seriesId <= 0) {
    return;
  }

  const store = readTvPendingStore();
  const userKey = pendingUserKey(playbackUser);
  store[userKey] = {
    ...(store[userKey] ?? {}),
    [nodeId]: { seriesId, progress },
  };
  writeTvPendingStore(store);
}

function updateTvPlaybackProgress(
  nodeId: number,
  progress: number,
): Promise<TvPlaybackProgress> {
  return apiRequest<TvPlaybackProgress>(`/api/playback/tv/${nodeId}`, {
    method: 'PUT',
    body: JSON.stringify({ progress }),
    keepalive: true,
  });
}

export function queueTvPlaybackProgressUpdate(
  playbackUser: string,
  nodeId: number,
  progress: number,
  seriesId: number,
): Promise<void> {
  return queuePlaybackProgressUpdate(
    tvUpdateQueues,
    playbackUser,
    nodeId,
    progress,
    updateTvPlaybackProgress,
    () => rememberPendingTvProgress(playbackUser, nodeId, seriesId, progress),
  );
}
