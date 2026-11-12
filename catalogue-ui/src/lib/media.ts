import type { Extra, Media, MovieResponse, NamedGenre, SeriesSummary } from '@/types';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export function catalogImage(
  path: string | null | undefined,
  size: 'w300' | 'w500' | 'w1280',
): string {
  if (!path) {
    return '';
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatSeriesMeta(seasonCount?: number, episodeCount?: number): string {
  const parts: string[] = [];
  if (seasonCount && seasonCount > 0) {
    parts.push(countLabel(seasonCount, 'season', 'seasons'));
  }
  if (episodeCount && episodeCount > 0) {
    parts.push(countLabel(episodeCount, 'episode', 'episodes'));
  }
  return parts.join('  ·  ');
}

export function formatRuntime(minutes: number): string {
  if (!minutes || minutes < 1) {
    return '';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${remainingMinutes}m`;
  }

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

export function yearFromReleaseDate(releaseDate: string | null): string {
  if (!releaseDate) {
    return '';
  }

  return releaseDate.slice(0, 4);
}

export function toStreamUrl(relativeUrl: string | undefined): string {
  if (!relativeUrl) {
    return '';
  }

  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }

  const normalized = relativeUrl.replace(/^\/+/, '');
  const withApiPrefix = normalized.startsWith('api/')
    ? normalized
    : `api/${normalized}`;

  return `${API_BASE_URL}/${withApiPrefix}`;
}

export function mapMovieToMedia(movie: MovieResponse): Media {
  const extras: Extra[] = movie.extras.map((extra) => ({
    ...extra,
    url: toStreamUrl(extra.url),
  }));

  return {
    id: movie.id,
    title: movie.title ?? movie.originalTitle ?? 'Untitled',
    type: 'movie',
    year: yearFromReleaseDate(movie.releaseDate),
    meta: formatRuntime(movie.runtime),
    image: catalogImage(movie.posterPath, 'w500'),
    backdrop: catalogImage(movie.backdropPath, 'w1280'),
    description: movie.overview ?? '',
    url: toStreamUrl(movie.url),
    extras,
    genres: movie.genres.filter((genre): genre is NamedGenre => Boolean(genre.name)),
    tagline: movie.tagline ?? undefined,
    progress: movie.progress,
  };
}

export function mapSeriesToMedia(series: SeriesSummary): Media {
  return {
    id: series.id,
    title: series.title ?? series.originalTitle ?? 'Untitled',
    type: 'tv',
    year: series.year ? String(series.year) : yearFromReleaseDate(series.releaseDate),
    meta: formatSeriesMeta(series.seasonCount, series.episodeCount),
    image: catalogImage(series.posterPath, 'w500'),
    backdrop: catalogImage(series.backdropPath, 'w1280'),
    description: series.overview ?? '',
    url: '',
    extras: [],
    genres: (series.genres ?? []).filter((genre): genre is NamedGenre => Boolean(genre.name)),
    tagline: series.tagline ?? undefined,
    episodeCount: series.episodeCount,
  };
}
