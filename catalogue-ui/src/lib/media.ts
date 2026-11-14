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

/** Watched time beside a movie progress bar, such as "1h 2m / 2h 35m". */
export function formatWatchedSpan(progressPercent: number, runtimeMinutes: number): string {
  if (!Number.isFinite(runtimeMinutes) || runtimeMinutes < 1) {
    return '';
  }

  const bounded = Math.min(100, Math.max(0, progressPercent));
  const elapsedMinutes = Math.round((bounded / 100) * runtimeMinutes);
  const elapsed = elapsedMinutes < 1 ? '0m' : formatRuntime(elapsedMinutes);
  return `${elapsed} / ${formatRuntime(runtimeMinutes)}`;
}

/** Watched time beside an episode bar, in the same form as a movie. Unwatched episodes show only the total. */
export function formatRuntimeSpan(progressPercent: number, runtime: string): string {
  const totalSeconds = parseClockRuntime(runtime);
  if (totalSeconds == null || totalSeconds < 1) {
    return '';
  }

  const bounded = Math.min(100, Math.max(0, progressPercent));
  const elapsedSeconds = Math.round((bounded / 100) * totalSeconds);
  const total = formatDurationMinutes(totalSeconds);
  if (!total) {
    return '';
  }
  if (elapsedSeconds < 1) {
    return total;
  }

  const elapsed = formatDurationMinutes(elapsedSeconds) || '0m';
  return `${elapsed} / ${total}`;
}

/** Extra length with seconds, such as "8m 46s", "2m 32s", or "56s". */
export function formatExtraRuntime(runtime: string): string {
  const trimmed = runtime.trim();
  if (trimmed.includes(':')) {
    const seconds = parseClockRuntime(trimmed);
    return seconds == null ? '' : formatDurationWithSeconds(seconds);
  }

  const minutes = parseHourMinuteRuntime(trimmed);
  if (minutes == null) {
    return '';
  }

  return formatRuntime(minutes);
}

/** Elapsed time for a movie extra, whether its runtime is "8:46" or "2m". */
export function formatExtraSpan(progressPercent: number, runtime: string): string {
  const trimmed = runtime.trim();
  if (trimmed.includes(':')) {
    const totalSeconds = parseClockRuntime(trimmed);
    if (totalSeconds == null || totalSeconds < 1) {
      return '';
    }

    const bounded = Math.min(100, Math.max(0, progressPercent));
    const elapsedSeconds = Math.round((bounded / 100) * totalSeconds);
    const total = formatDurationWithSeconds(totalSeconds);
    if (!total) {
      return '';
    }

    const elapsed = elapsedSeconds < 1 ? '0s' : formatDurationWithSeconds(elapsedSeconds);
    return `${elapsed} / ${total}`;
  }

  const minutes = parseHourMinuteRuntime(trimmed);
  if (minutes == null) {
    return '';
  }

  return formatWatchedSpan(progressPercent, minutes);
}

function formatDurationWithSeconds(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds);
  if (seconds < 1) {
    return '';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts: string[] = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0) {
    parts.push(`${minutes}m`);
  }
  if (remainingSeconds > 0) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(' ');
}

function parseHourMinuteRuntime(runtime: string): number | null {
  const match = runtime.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?$/);
  if (!match || (match[1] === undefined && match[2] === undefined)) {
    return null;
  }

  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

function formatDurationMinutes(totalSeconds: number): string {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) {
    return totalSeconds > 0 ? '0m' : '';
  }

  return formatRuntime(minutes);
}

function parseClockRuntime(runtime: string): number | null {
  const parts = runtime.trim().split(':').map((part) => Number(part));
  if (
    parts.length < 2
    || parts.length > 3
    || parts.some((part) => !Number.isInteger(part) || part < 0)
  ) {
    return null;
  }

  const seconds = parts[parts.length - 1] ?? 0;
  const minutes = parts[parts.length - 2] ?? 0;
  const hours = parts.length === 3 ? parts[0] ?? 0 : 0;
  if (minutes > 59 || seconds > 59) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
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
    runtimeMinutes: movie.runtime > 0 ? movie.runtime : undefined,
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
