import { create } from 'zustand';
import type { MoviePlaybackProgress, TvPlaybackProgress } from '@/api/playback';
import {
  orderSeriesProgress,
  type SeriesProgressEntry,
} from '@/lib/continueWatching';

const LEGACY_PROGRESS_KEY = 'catalogue-watch-progress';

type WatchProgressState = {
  progressById: Record<number, number>;
  tvProgressByNodeId: Record<number, number>;
  /** Newest playback first, so a series rail can use the latest unfinished episode. */
  tvProgressEntries: SeriesProgressEntry[];
  hydratedFor: string | null;
  tvHydratedFor: string | null;
  hydrateProgress: (userName: string, items: MoviePlaybackProgress[]) => void;
  hydrateTvProgress: (userName: string, items: TvPlaybackProgress[]) => void;
  resetProgress: () => void;
  setProgress: (id: number, percent: number) => void;
  setTvProgress: (id: number, percent: number, seriesId?: number) => void;
};

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

function writeProgress(
  current: Record<number, number>,
  id: number,
  percent: number,
): Record<number, number> | null {
  const next = clampPercent(percent);
  const previous = current[id];

  if (previous === next) {
    return null;
  }

  if (previous !== undefined && next < 100 && Math.abs(next - previous) < 2) {
    return null;
  }

  return {
    ...current,
    [id]: next,
  };
}

export function clearLegacyWatchProgress(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(LEGACY_PROGRESS_KEY);
    } catch {
      // Storage can be disabled; the legacy data is never read or uploaded.
    }
  }
}

function toSeriesProgress(items: TvPlaybackProgress[]): SeriesProgressEntry[] {
  return orderSeriesProgress(
    items.map((item) => ({
      nodeId: item.nodeId,
      seriesId: item.seriesId,
      progress: clampPercent(item.progress),
    })),
  );
}

export const useWatchProgressStore = create<WatchProgressState>()((set) => ({
  progressById: {},
  tvProgressByNodeId: {},
  tvProgressEntries: [],
  hydratedFor: null,
  tvHydratedFor: null,
  hydrateProgress: (userName, items) =>
    set({
      progressById: Object.fromEntries(
        items.map((item) => [item.movieId, clampPercent(item.progress)]),
      ),
      hydratedFor: userName,
    }),
  hydrateTvProgress: (userName, items) => {
    const tvProgressEntries = toSeriesProgress(items);
    set({
      tvProgressByNodeId: Object.fromEntries(
        tvProgressEntries.map((item) => [item.nodeId, item.progress]),
      ),
      tvProgressEntries,
      tvHydratedFor: userName,
    });
  },
  resetProgress: () =>
    set({
      progressById: {},
      tvProgressByNodeId: {},
      tvProgressEntries: [],
      hydratedFor: null,
      tvHydratedFor: null,
    }),
  setProgress: (id, percent) =>
    set((state) => {
      const progressById = writeProgress(state.progressById, id, percent);
      return progressById ? { progressById } : state;
    }),
  setTvProgress: (id, percent, seriesId) =>
    set((state) => {
      const tvProgressByNodeId = writeProgress(state.tvProgressByNodeId, id, percent);
      const existing = state.tvProgressEntries.find((entry) => entry.nodeId === id);
      const nextSeriesId = seriesId && seriesId > 0 ? seriesId : existing?.seriesId ?? 0;
      const nextPercent = tvProgressByNodeId?.[id] ?? existing?.progress;
      if (nextPercent === undefined || nextSeriesId <= 0) {
        return tvProgressByNodeId ? { tvProgressByNodeId } : state;
      }
      if (!tvProgressByNodeId && existing?.seriesId === nextSeriesId) {
        return state;
      }

      return {
        tvProgressByNodeId: tvProgressByNodeId ?? state.tvProgressByNodeId,
        tvProgressEntries: [
          { nodeId: id, seriesId: nextSeriesId, progress: nextPercent },
          ...state.tvProgressEntries.filter((entry) => entry.nodeId !== id),
        ],
      };
    }),
}));
