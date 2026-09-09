import type { Extra, Media, MovieResponse, NamedGenre } from '@/types';

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

function tmdbImageUrl(path: string | null, size: 'w500' | 'w1280'): string {
  if (!path) {
    return '';
  }

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  return `${TMDB_IMAGE_BASE}/${size}${path}`;
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
    image: tmdbImageUrl(movie.posterPath, 'w500'),
    backdrop: tmdbImageUrl(movie.backdropPath, 'w1280'),
    description: movie.overview ?? '',
    url: toStreamUrl(movie.url),
    extras,
    genres: movie.genres.filter((genre): genre is NamedGenre => Boolean(genre.name)),
    tagline: movie.tagline ?? undefined,
    progress: movie.progress,
  };
}
