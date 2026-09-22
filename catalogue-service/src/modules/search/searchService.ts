import { searchMoviesByTitle } from "../../infra/db/repositories/searchRepository.js";
import {
  applyStreamUrls,
  mapMovie,
  type MovieResponse,
} from "../../shared/movies/movieResponse.js";

export interface SearchResult {
  query: string;
  totalResults: number;
  results: MovieResponse[];
}

/**
 * Search local movies by title.
 * Mirrors MovieBrowseService but searches by query instead of directory.
 */
export async function searchMovies(query: string): Promise<SearchResult> {
  const movies = await searchMoviesByTitle(query);
  const results = movies.map(mapMovie);

  applyStreamUrls(results);

  return {
    query,
    totalResults: results.length,
    results,
  };
}
