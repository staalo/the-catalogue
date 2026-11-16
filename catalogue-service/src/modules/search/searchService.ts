import { searchMoviesByTitle } from "../../infra/db/repositories/searchRepository.js";
import { searchSeriesByTitle } from "../../infra/db/repositories/localSeriesRepository.js";
import { getMediaPaths } from "../media-paths/mediaPathService.js";
import { attachMovieSubtitles } from "../stream/sidecarSubtitles.js";
import {
  applyStreamUrls,
  mapMovie,
  type MovieResponse,
} from "../../shared/movies/movieResponse.js";
import { mapSeriesSummary, type TvSearchResult } from "../tv/tvResponse.js";

export interface SearchResult {
  query: string;
  totalResults: number;
  results: MovieResponse[];
}

/**
 * Search local movies by title.
 */
export async function searchMovies(query: string): Promise<SearchResult> {
  const movies = await searchMoviesByTitle(query);
  const results = movies.map(mapMovie);
  await attachMovieSubtitles(results);
  applyStreamUrls(results);

  return {
    query,
    totalResults: results.length,
    results,
  };
}

/**
 * Search local TV series by title. Results are series summaries; the episode
 * tree is available from the series detail route.
 */
export async function searchTv(query: string): Promise<TvSearchResult> {
  const trimmed = query.trim();
  const tvPath = getMediaPaths()?.tvPath;
  if (!tvPath || trimmed.length === 0) {
    return { query: trimmed, totalResults: 0, results: [] };
  }

  const series = await searchSeriesByTitle(trimmed, tvPath);
  const results = series.map(mapSeriesSummary);

  return {
    query: trimmed,
    totalResults: results.length,
    results,
  };
}
