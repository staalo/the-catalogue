import { getMediaPaths } from "../media-paths/mediaPathService.js";
import { getMoviesPaginated } from "../../infra/db/repositories/localMovieRepository.js";
import {
  applyStreamUrls,
  mapMovie,
  type MovieResponse,
} from "../../shared/movies/movieResponse.js";

export type {
  CastMemberResponse,
  CrewMemberResponse,
  ExtraResponse,
  GenreResponse,
  MovieResponse,
} from "../../shared/movies/movieResponse.js";

export interface BrowseResult {
  page: number;
  results: MovieResponse[];
  totalPages: number;
  totalResults: number;
}

/**
 * Browse the shared movie library.
 * Mirrors MovieBrowseService.BrowseMovies() + LocalMovieBrowseRepository.BrowseMovies().
 */
export async function browseMovies(page: number): Promise<BrowseResult> {
  const mediaPaths = getMediaPaths();

  if (!mediaPaths?.moviesPath) {
    return { page, results: [], totalPages: 0, totalResults: 0 };
  }

  const { movies, totalCount } = await getMoviesPaginated(
    mediaPaths.moviesPath,
    page,
  );
  const totalPages = Math.ceil(totalCount / 20);

  const results = movies.map(mapMovie);
  applyStreamUrls(results);

  return { page, results, totalPages, totalResults: totalCount };
}

/**
 * TV series are not catalogued yet. The response matches movie browse so the
 * client can show the library total as soon as series are returned.
 */
export async function browseTv(page: number): Promise<BrowseResult> {
  return { page, results: [], totalPages: 0, totalResults: 0 };
}
