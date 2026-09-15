import { useQuery } from '@tanstack/react-query';
import { browseMovies, searchMovies } from '@/api/catalogue';
import { useWatchProgressStore } from '@/stores/useWatchProgressStore';
import type { Media, MediaType } from '@/types';

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

  if (type === 'tv') {
    return {
      data: [],
      featured: null,
      isLoading: false,
      isError: false,
      error: null,
    };
  }

  const data = withLocalProgress(
    isSearching ? (searchQuery.data ?? []) : (browseQuery.data ?? []),
    progressById,
  );
  const featuredSource = browseQuery.data?.[0] ?? data[0] ?? null;
  const featured = featuredSource
    ? (withLocalProgress([featuredSource], progressById)[0] ?? null)
    : null;

  return {
    data,
    featured,
    isLoading: isSearching ? searchQuery.isLoading : browseQuery.isLoading,
    isError: isSearching ? searchQuery.isError : browseQuery.isError,
    error: isSearching ? searchQuery.error : browseQuery.error,
  };
}
