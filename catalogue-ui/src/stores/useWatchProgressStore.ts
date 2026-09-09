import { persist } from 'zustand/middleware';
import { create } from 'zustand';

type WatchProgressState = {
  progressById: Record<number, number>;
  setProgress: (id: number, percent: number) => void;
};

function clampPercent(percent: number): number {
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export const useWatchProgressStore = create<WatchProgressState>()(
  persist(
    (set) => ({
      progressById: {},
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
    }),
    { name: 'catalogue-watch-progress' },
  ),
);
