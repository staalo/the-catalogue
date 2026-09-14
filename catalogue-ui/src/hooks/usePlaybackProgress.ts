import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMoviePlaybackProgress } from "@/api/playback";
import { useWatchProgressStore } from "@/stores/useWatchProgressStore";

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
    resetProgress();
  }, [userName, resetProgress]);

  useEffect(() => {
    if (userName && query.data) {
      hydrateProgress(userName, query.data);
    }
  }, [userName, query.data, hydrateProgress]);

  useEffect(() => {
    if (userName && query.isError) {
      hydrateProgress(userName, []);
    }
  }, [userName, query.isError, hydrateProgress]);

  return {
    ...query,
    isHydrated: !userName || hydratedFor === userName,
  };
}
