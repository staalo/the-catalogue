import { create } from 'zustand';
import type { MoviePlaybackProgress } from '@/api/playback';

type WatchProgressState = {
  progressById: Record<number, number>;
  hydratedFor: string | null;
  hydrateProgress: (userName: string, items: MoviePlaybackProgress[]) => void;
  resetProgress: () => void;
  setProgress: (id: number, percent: number) => void;
};

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export const useWatchProgressStore = create<WatchProgressState>()((set) => ({
  progressById: {},
  hydratedFor: null,
  hydrateProgress: (userName, items) =>
    set({
      progressById: Object.fromEntries(
        items.map((item) => [item.movieId, clampPercent(item.progress)]),
      ),
      hydratedFor: userName,
    }),
  resetProgress: () => set({ progressById: {}, hydratedFor: null }),
  setProgress: (id, percent) =>
    set((state) => {
      const next = clampPercent(percent);
      const previous = state.progressById[id];

      if (previous === next) {
        return state;
      }

      if (previous !== undefined && next < 100 && Math.abs(next - previous) < 2) {
        return state;
      }

      return {
        progressById: {
          ...state.progressById,
          [id]: next,
        },
      };
    }),
}));
