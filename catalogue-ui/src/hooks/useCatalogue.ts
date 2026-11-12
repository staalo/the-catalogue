import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { browseMovies, browseTv, searchMovies, searchTv } from '@/api/catalogue';
import {
  continueProgressBySeries,
  seriesIdsToContinue,
  type SeriesProgressEntry,
} from '@/lib/continueWatching';
import { useWatchProgressStore } from '@/stores/useWatchProgressStore';
import type { Media, MediaType } from '@/types';

const FEATURED_ROTATION_MS = 2 * 60 * 1000;

function pickDifferentIndex(length: number, current: number): number {
  if (length <= 1) {
    return 0;
  }

  let next = Math.floor(Math.random() * (length - 1));
  if (next >= current) {
    next += 1;
  }

  return next;
}

function useRotatingFeatured(items: Media[]): Media | null {
  const listKey = items.map((item) => `${item.type}:${item.id}`).join('\0');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [listKey]);

  useEffect(() => {
    if (items.length < 2) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => pickDifferentIndex(items.length, current));
    }, FEATURED_ROTATION_MS);

    return () => window.clearInterval(timer);
  }, [listKey, items.length]);

  return items[index] ?? items[0] ?? null;
}

function withLocalProgress(
  items: Media[],
  progressById: Record<number, number>,
): Media[] {
  return items.map((item) => {
    const localProgress = progressById[item.id];
    return localProgress === undefined ? item : { ...item, progress: localProgress };
  });
}

function withSeriesProgress(items: Media[], entries: SeriesProgressEntry[]): Media[] {
  const episodeCountBySeries = new Map(
    items.map((item) => [item.id, item.episodeCount ?? 0]),
  );
  const progressBySeries = continueProgressBySeries(entries);
  const continueIds = seriesIdsToContinue(entries, episodeCountBySeries);
  if (progressBySeries.size === 0 && continueIds.size === 0) {
    return items;
  }

  return items.map((item) => {
    const progress = progressBySeries.get(item.id);
    const continueSeries = continueIds.has(item.id);
    if (progress === undefined && !continueSeries) {
      return item;
    }

    return {
      ...item,
      ...(progress === undefined ? {} : { progress }),
      ...(continueSeries ? { continueSeries: true } : {}),
    };
  });
}

export function useCatalogue(
  type: MediaType,
  search: string,
  userName?: string,
) {
  const trimmedSearch = search.trim();
  const isSearching = trimmedSearch.length > 0;
  const canFetch = Boolean(userName);
  const progressById = useWatchProgressStore((state) => state.progressById);
  const tvProgressEntries = useWatchProgressStore((state) => state.tvProgressEntries);

  const browseQuery = useQuery({
    queryKey: ['catalogue', 'browse', userName, type],
    queryFn: () => (type === 'tv' ? browseTv() : browseMovies()),
    enabled: canFetch,
  });

  const searchQuery = useQuery({
    queryKey: ['catalogue', 'search', userName, type, trimmedSearch],
    queryFn: () => (type === 'tv' ? searchTv(trimmedSearch) : searchMovies(trimmedSearch)),
    enabled: canFetch && isSearching,
  });

  const activeQuery = isSearching ? searchQuery : browseQuery;
  const items = activeQuery.data?.items ?? [];
  const data = type === 'movie'
    ? withLocalProgress(items, progressById)
    : withSeriesProgress(items, tvProgressEntries);
  const featured = useRotatingFeatured(data);

  return {
    data,
    totalResults: activeQuery.data?.totalResults ?? 0,
    featured,
    isLoading: activeQuery.isLoading,
    isError: activeQuery.isError,
    error: activeQuery.error,
  };
}
