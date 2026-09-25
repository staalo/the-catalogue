import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { browseMovies, searchMovies } from '@/api/catalogue';
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
  const canFetchMovies = Boolean(userName) && type === 'movie';
  const progressById = useWatchProgressStore((state) => state.progressById);

  const browseQuery = useQuery({
    queryKey: ['catalogue', 'browse', userName, type],
    queryFn: () => browseMovies(),
    enabled: canFetchMovies,
  });

  const searchQuery = useQuery({
    queryKey: ['catalogue', 'search', userName, type, trimmedSearch],
    queryFn: () => searchMovies(trimmedSearch),
    enabled: canFetchMovies && isSearching,
  });

  const data =
    type === 'tv'
      ? []
      : withLocalProgress(
          isSearching ? (searchQuery.data ?? []) : (browseQuery.data ?? []),
          progressById,
        );
  const featured = useRotatingFeatured(data);

  if (type === 'tv') {
    return {
      data: [],
      featured: null,
      isLoading: false,
      isError: false,
      error: null,
    };
  }

  return {
    data,
    featured,
    isLoading: isSearching ? searchQuery.isLoading : browseQuery.isLoading,
    isError: isSearching ? searchQuery.isError : browseQuery.isError,
    error: isSearching ? searchQuery.error : browseQuery.error,
  };
}
