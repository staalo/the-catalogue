import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  discardPendingPlaybackProgress,
  getPendingPlaybackProgress,
  getMoviePlaybackProgress,
  queueMoviePlaybackProgressUpdate,
  reconcilePendingPlaybackProgress,
  setPlaybackProgressSession,
} from "@/api/playback";
import { ApiError } from "@/lib/api";
import {
  clearLegacyWatchProgress,
  useWatchProgressStore,
} from "@/stores/useWatchProgressStore";

export function usePlaybackProgress(userName?: string) {
  const hydrateProgress = useWatchProgressStore(
    (state) => state.hydrateProgress,
  );
  const hydratedFor = useWatchProgressStore((state) => state.hydratedFor);
  const resetProgress = useWatchProgressStore((state) => state.resetProgress);

  const query = useQuery({
    queryKey: ["playback", "movies", userName],
    queryFn: getMoviePlaybackProgress,
    enabled: Boolean(userName),
    retry: 1,
  });

  useEffect(() => {
    setPlaybackProgressSession(userName);
    resetProgress();
    if (userName) {
      clearLegacyWatchProgress();
    }
  }, [userName, resetProgress]);

  useEffect(() => {
    if (!userName || !query.data) {
      return;
    }

    reconcilePendingPlaybackProgress(userName, query.data);
    const pendingItems = getPendingPlaybackProgress(userName);
    hydrateProgress(userName, [...query.data, ...pendingItems]);

    if (pendingItems.length === 0) {
      return;
    }

    let cancelled = false;
    void Promise.allSettled(
      pendingItems.map((item) =>
        queueMoviePlaybackProgressUpdate(
          userName,
          item.movieId,
          item.progress,
        ),
      ),
    ).then((results) => {
      results.forEach((result, index) => {
        const item = pendingItems[index];
        if (
          !cancelled
          && item
          && result.status === "rejected"
          && result.reason instanceof ApiError
          && (result.reason.status === 403 || result.reason.status === 404)
        ) {
          discardPendingPlaybackProgress(userName, item.movieId);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [userName, query.data, hydrateProgress]);

  useEffect(() => {
    if (userName && query.isError) {
      hydrateProgress(userName, getPendingPlaybackProgress(userName));
    }
  }, [userName, query.isError, hydrateProgress]);

  return {
    ...query,
    isHydrated: !userName || hydratedFor === userName,
  };
}
