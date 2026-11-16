import path from "node:path";
import type { MovieWithRelations } from "../../infra/db/repositories/localMovieRepository.js";

// ---------------------------------------------------------------------------
// API response types.
// ---------------------------------------------------------------------------

export interface CastMemberResponse {
  id: number;
  adult: boolean;
  castId: number;
  character: string | null;
  creditId: string | null;
  gender: number | null;
  knownForDepartment: string | null;
  name: string | null;
  order: number;
  originalName: string | null;
  popularity: number;
  profilePath: string | null;
}

export interface CrewMemberResponse {
  id: number;
  adult: boolean;
  creditId: string | null;
  department: string | null;
  gender: number | null;
  job: string | null;
  knownForDepartment: string | null;
  name: string | null;
  originalName: string | null;
  popularity: number;
  profilePath: string | null;
}

export interface GenreResponse {
  id: number;
  name: string | null;
}

export interface SubtitleTrackResponse {
  language: string;
  label: string;
  url: string;
}

export interface ExtraResponse {
  id: number;
  title: string;
  runtime: string;
  url: string;
  subtitles: SubtitleTrackResponse[];
}

export interface MovieResponse {
  id: number;
  adult: boolean;
  homepage: string | null;
  imdbId: string | null;
  originalLanguage: string | null;
  originalTitle: string | null;
  overview: string | null;
  popularity: number;
  posterPath: string | null;
  backdropPath: string | null;
  releaseDate: string | null;
  runtime: number;
  tagline: string | null;
  title: string | null;
  voteAverage: number;
  voteCount: number;
  url: string;
  subtitles: SubtitleTrackResponse[];
  hasExtras: boolean;
  cast: CastMemberResponse[];
  crew: CrewMemberResponse[];
  genres: GenreResponse[];
  extras: ExtraResponse[];
}

// ---------------------------------------------------------------------------
// Stream URL helpers.
// ---------------------------------------------------------------------------

/**
 * Extracts a safe filename from an arbitrary file path for use in stream URLs.
 */
export function getStreamFileName(filePath: string): string {
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
 * Shapes all stream URLs on a movie result set.
 */
export function applyStreamUrls(results: MovieResponse[]): void {
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

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/**
 * Map a database movie (with relations) to the API response.
 */
export function mapMovie(m: MovieWithRelations): MovieResponse {
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
    subtitles: [],
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
      subtitles: [],
    })),
  };
}
