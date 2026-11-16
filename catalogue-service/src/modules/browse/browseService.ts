import { getMediaPaths } from "../media-paths/mediaPathService.js";
import { getMoviesPaginated } from "../../infra/db/repositories/localMovieRepository.js";
import {
  getSeriesDetailRecord,
  getSeriesPage,
  SERIES_PAGE_SIZE,
} from "../../infra/db/repositories/localSeriesRepository.js";
import {
  attachMovieSubtitles,
  subtitlesByNodeId,
} from "../stream/sidecarSubtitles.js";
import {
  applyStreamUrls,
  mapMovie,
  type MovieResponse,
} from "../../shared/movies/movieResponse.js";
import {
  mapSeriesDetail,
  mapSeriesSummary,
  type SeriesDetail,
  type TvBrowseResult,
} from "../tv/tvResponse.js";

export type {
  CastMemberResponse,
  CrewMemberResponse,
  ExtraResponse,
  GenreResponse,
  MovieResponse,
  SubtitleTrackResponse,
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
  await attachMovieSubtitles(results);
  applyStreamUrls(results);

  return { page, results, totalPages, totalResults: totalCount };
}

/**
 * Browse the shared TV library. Each result is a series summary.
 * The season/episode/extras tree is loaded separately from getSeriesDetail.
 */
export async function browseTv(page: number): Promise<TvBrowseResult> {
  const mediaPaths = getMediaPaths();

  if (!mediaPaths?.tvPath) {
    return { page, results: [], totalPages: 0, totalResults: 0 };
  }

  const { series, totalCount } = await getSeriesPage(mediaPaths.tvPath, page);
  const totalPages =
    totalCount === 0 ? 0 : Math.ceil(totalCount / SERIES_PAGE_SIZE);

  return {
    page,
    results: series.map(mapSeriesSummary),
    totalPages,
    totalResults: totalCount,
  };
}

/** One series, including the playable manifest tree. */
export async function getSeriesDetail(
  seriesId: number,
): Promise<SeriesDetail | null> {
  const mediaPaths = getMediaPaths();
  if (!mediaPaths?.tvPath || !Number.isInteger(seriesId) || seriesId <= 0) {
    return null;
  }

  const record = await getSeriesDetailRecord(mediaPaths.tvPath, seriesId);
  if (!record) {
    return null;
  }

  const subtitles = await subtitlesByNodeId(record.series.id, record.nodes);
  return mapSeriesDetail(record.series, record.nodes, subtitles);
}
