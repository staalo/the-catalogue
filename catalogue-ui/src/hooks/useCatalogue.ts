import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { browseMovies, browseTv, searchMovies } from '@/api/catalogue';
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
  const listKey = items.map((item) => item.id).join('\0');
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

export function useCatalogue(
  type: MediaType,
  search: string,
  userName?: string,
) {
  const trimmedSearch = search.trim();
  const isSearching = trimmedSearch.length > 0;
  const canFetch = Boolean(userName);
  const canFetchMovies = canFetch && type === 'movie';
  const progressById = useWatchProgressStore((state) => state.progressById);

  const browseQuery = useQuery({
    queryKey: ['catalogue', 'browse', userName, type],
    queryFn: () => (type === 'tv' ? browseTv() : browseMovies()),
    enabled: canFetch,
  });

  const searchQuery = useQuery({
    queryKey: ['catalogue', 'search', userName, type, trimmedSearch],
    queryFn: () => searchMovies(trimmedSearch),
    enabled: canFetchMovies && isSearching,
  });

  const catalogue =
    type === 'tv' || !isSearching ? browseQuery.data : searchQuery.data;
  const data = withLocalProgress(catalogue?.items ?? [], progressById);
  const featured = useRotatingFeatured(type === 'tv' ? [] : data);
  const totalResults = catalogue?.totalResults ?? 0;

  if (type === 'tv') {
    return {
      data,
      totalResults,
      featured: null,
      isLoading: browseQuery.isLoading,
      isError: browseQuery.isError,
      error: browseQuery.error,
    };
  }

  return {
    data,
    totalResults,
    featured,
    isLoading: isSearching ? searchQuery.isLoading : browseQuery.isLoading,
    isError: isSearching ? searchQuery.isError : browseQuery.isError,
    error: isSearching ? searchQuery.error : browseQuery.error,
  };
}
