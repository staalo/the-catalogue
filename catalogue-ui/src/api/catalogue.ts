import { apiGet, ApiError } from '@/lib/api';
import { mapMovieToMedia, mapSeriesToMedia } from '@/lib/media';
import type {
  BrowseResult,
  Media,
  SearchResult,
  SeriesDetail,
  TvBrowseResult,
  TvSearchResult,
} from '@/types';

export type CatalogueList = {
  items: Media[];
  totalResults: number;
};

const emptyCatalogue: CatalogueList = { items: [], totalResults: 0 };

export async function browseTv(page = 1): Promise<CatalogueList> {
  try {
    const result = await apiGet<TvBrowseResult>(
      `/api/browse/browsetv?page=${page}`,
    );
    return {
      items: result.results.map(mapSeriesToMedia),
      totalResults: result.totalResults,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return emptyCatalogue;
    }

    throw error;
  }
}

export async function getSeriesDetail(seriesId: number): Promise<SeriesDetail> {
  return apiGet<SeriesDetail>(`/api/browse/tv/${seriesId}`);
}

export async function searchTv(query: string): Promise<CatalogueList> {
  const trimmed = query.trim();

  if (!trimmed) {
    return emptyCatalogue;
  }

  try {
    const result = await apiGet<TvSearchResult>(
      `/api/search/tv?q=${encodeURIComponent(trimmed)}`,
    );
    return {
      items: result.results.map(mapSeriesToMedia),
      totalResults: result.totalResults,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return emptyCatalogue;
    }

    throw error;
  }
}

export async function browseMovies(page = 1): Promise<CatalogueList> {
  try {
    const result = await apiGet<BrowseResult>(
      `/api/browse/browsemovies?page=${page}`,
    );
    return {
      items: result.results.map(mapMovieToMedia),
      totalResults: result.totalResults,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return emptyCatalogue;
    }

    throw error;
  }
}

export async function searchMovies(query: string): Promise<CatalogueList> {
  const trimmed = query.trim();

  if (!trimmed) {
    return emptyCatalogue;
  }

  try {
    const result = await apiGet<SearchResult>(
      `/api/search/movies?q=${encodeURIComponent(trimmed)}`,
    );
    return {
      items: result.results.map(mapMovieToMedia),
      totalResults: result.totalResults,
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return emptyCatalogue;
    }

    throw error;
  }
}
