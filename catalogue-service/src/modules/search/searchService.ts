import path from "node:path";
import { searchMoviesByTitle } from "../../infra/db/repositories/searchRepository.js";
import type { MovieWithRelations } from "../../infra/db/repositories/localMovieRepository.js";
import type { MovieResponse } from "../browse/browseService.js";

export interface SearchResult {
  query: string;
  totalResults: number;
  results: MovieResponse[];
}

/**
 * Extracts a safe filename from an arbitrary file path for use in stream URLs.
 * Mirrors MovieBrowseService.GetStreamFileName().
 */
function getStreamFileName(filePath: string): string {
  if (!filePath || filePath.trim() === "") {
    return "master.m3u8";
  }

  if (filePath.toLowerCase().startsWith("stream/")) {
    const lastSlash = filePath.lastIndexOf("/");
    if (lastSlash >= 0 && lastSlash < filePath.length - 1) {
      const segment = filePath.slice(lastSlash + 1);
      if (segment && !segment.includes("/") && segment.includes(".")) {
        return segment;
      }
    }
    return "master.m3u8";
  }

  const fileName = path.basename(filePath);
  if (!fileName || fileName.includes("\0")) {
    return "master.m3u8";
  }

  return fileName;
}

/**
 * Shapes all stream URLs on the search result.
 * Mirrors MovieBrowseService.ApplyStreamUrls().
 */
function applyStreamUrls(results: MovieResponse[]): void {
  for (const movie of results) {
    if (movie.id > 0) {
      movie.url = `stream/movies/${movie.id}/${getStreamFileName(movie.url)}`;

      for (const extra of movie.extras) {
        if (extra.id > 0) {
          extra.url = `stream/movies/${movie.id}/extras/${extra.id}/${getStreamFileName(extra.url)}`;
        }
      }
    }
  }
}

/**
 * Map a database movie to the response DTO.
 * Mirrors MovieResponse mapping logic from browseService.
 */
function mapMovie(m: MovieWithRelations): MovieResponse {
  return {
    id: m.id,
    adult: m.adult,
    homepage: m.homepage,
    imdbId: m.imdbId,
    originalLanguage: m.originalLanguage,
    originalTitle: m.originalTitle,
    overview: m.overview,
    popularity: m.popularity,
    posterPath: m.posterPath,
    backdropPath: m.backdropPath,
    releaseDate: m.releaseDate,
    runtime: m.runtime,
    tagline: m.tagline,
    title: m.title,
    voteAverage: m.voteAverage,
    voteCount: m.voteCount,
    url: m.url,
    hasExtras: m.hasExtras,
    cast: m.cast.map((c) => ({
      id: c.id,
      adult: c.adult,
      castId: c.castId,
      character: c.character,
      creditId: c.creditId,
      gender: c.gender,
      knownForDepartment: c.knownForDepartment,
      name: c.name,
      order: c.order,
      originalName: c.originalName,
      popularity: c.popularity,
      profilePath: c.profilePath,
    })),
    crew: m.crew.map((c) => ({
      id: c.id,
      adult: c.adult,
      creditId: c.creditId,
      department: c.department,
      gender: c.gender,
      job: c.job,
      knownForDepartment: c.knownForDepartment,
      name: c.name,
      originalName: c.originalName,
      popularity: c.popularity,
      profilePath: c.profilePath,
    })),
    genres: m.genres.map((g) => ({
      id: g.id,
      name: g.name,
    })),
    extras: m.extras.map((e) => ({
      id: e.id,
      title: e.title,
      runtime: e.runtime,
      url: e.url,
    })),
  };
}

/**
 * Search local movies by title.
 * Mirrors MovieBrowseService but searches by query instead of directory.
 */
export async function searchMovies(query: string): Promise<SearchResult> {
  const movies = await searchMoviesByTitle(query);
  const results = movies.map(mapMovie);

  // Apply stream URL shaping (same as browse)
  applyStreamUrls(results);

  return {
    query,
    totalResults: results.length,
    results,
  };
}
