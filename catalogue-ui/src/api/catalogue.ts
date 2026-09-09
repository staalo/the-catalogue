import { apiGet, ApiError } from '@/lib/api';
import { mapMovieToMedia } from '@/lib/media';
import type { BrowseResult, Media, SearchResult } from '@/types';

export async function browseMovies(page = 1): Promise<Media[]> {
  try {
    const result = await apiGet<BrowseResult>(
      `/api/browse/browsemovies?page=${page}`,
    );
    return result.results.map(mapMovieToMedia);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}

export async function searchMovies(query: string): Promise<Media[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  try {
    const result = await apiGet<SearchResult>(
      `/api/search/movies?q=${encodeURIComponent(trimmed)}`,
    );
    return result.results.map(mapMovieToMedia);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }

    throw error;
  }
}
