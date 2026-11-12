import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  discardPendingPlaybackProgress,
  discardPendingTvPlaybackProgress,
  getPendingPlaybackProgress,
  getPendingTvPlaybackProgress,
  getMoviePlaybackProgress,
  getTvPlaybackProgress,
  queueMoviePlaybackProgressUpdate,
  queueTvPlaybackProgressUpdate,
  reconcilePendingPlaybackProgress,
  reconcilePendingTvPlaybackProgress,
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
  const hydrateTvProgress = useWatchProgressStore(
    (state) => state.hydrateTvProgress,
  );
  const hydratedFor = useWatchProgressStore((state) => state.hydratedFor);
  const tvHydratedFor = useWatchProgressStore((state) => state.tvHydratedFor);
  const resetProgress = useWatchProgressStore((state) => state.resetProgress);

  const query = useQuery({
    queryKey: ["playback", "movies", userName],
    queryFn: getMoviePlaybackProgress,
    enabled: Boolean(userName),
    retry: 1,
  });

  const tvQuery = useQuery({
    queryKey: ["playback", "tv", userName],
    queryFn: getTvPlaybackProgress,
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
    if (!userName || !tvQuery.data) {
      return;
    }

    reconcilePendingTvPlaybackProgress(userName, tvQuery.data);
    const pendingItems = getPendingTvPlaybackProgress(userName);
    hydrateTvProgress(userName, [...tvQuery.data, ...pendingItems]);

    if (pendingItems.length === 0) {
      return;
    }

    let cancelled = false;
    void Promise.allSettled(
      pendingItems.map((item) =>
        queueTvPlaybackProgressUpdate(
          userName,
          item.nodeId,
          item.progress,
          item.seriesId,
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
          discardPendingTvPlaybackProgress(userName, item.nodeId);
        }
      });
    });

    return () => {
      cancelled = true;
    };
  }, [userName, tvQuery.data, hydrateTvProgress]);

  useEffect(() => {
    if (userName && query.isError) {
      hydrateProgress(userName, getPendingPlaybackProgress(userName));
    }
  }, [userName, query.isError, hydrateProgress]);

  useEffect(() => {
    if (userName && tvQuery.isError) {
      hydrateTvProgress(userName, getPendingTvPlaybackProgress(userName));
    }
  }, [userName, tvQuery.isError, hydrateTvProgress]);

  return {
    ...query,
    isHydrated:
      !userName || (hydratedFor === userName && tvHydratedFor === userName),
  };
}
