/**
 * TMDB API integration service.
 * Handles searching for movies and fetching detailed metadata.
 */

// Minimal rate limiting: track call timestamps
let lastCallTime = 0;
const MIN_CALL_INTERVAL_MS = 250; // 250ms between calls = ~4 per second (safe for free tier)

export interface TmdbCastMember {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  order?: number;
  adult?: boolean;
  cast_id?: number;
  credit_id?: string;
  gender?: number | null;
  known_for_department?: string;
  original_name?: string;
  popularity?: number;
}

export interface TmdbCrewMember {
  id: number;
  name: string;
  job?: string;
  department?: string;
  profile_path?: string | null;
  adult?: boolean;
  credit_id?: string;
  gender?: number | null;
  known_for_department?: string;
  original_name?: string;
  popularity?: number;
}

export interface MappedLocalCastMember {
  personId: number;
  name: string;
  character?: string | undefined;
  profilePath?: string | null | undefined;
  order: number;
  adult: boolean;
  castId: number;
  creditId?: string | undefined;
  gender?: number | null | undefined;
  knownForDepartment?: string | undefined;
  originalName?: string | undefined;
  popularity: number;
}

export interface MappedLocalCrewMember {
  personId: number;
  name: string;
  job?: string | undefined;
  department?: string | undefined;
  profilePath?: string | null | undefined;
  adult: boolean;
  creditId?: string | undefined;
  gender?: number | null | undefined;
  knownForDepartment?: string | undefined;
  originalName?: string | undefined;
  popularity: number;
}

/**
 * Map a TMDB credits.cast entry (snake_case) onto the local cast columns.
 */
export function mapTmdbCastMember(
  member: TmdbCastMember,
): MappedLocalCastMember {
  return {
    personId: member.id,
    name: member.name,
    character: member.character,
    profilePath: member.profile_path,
    order: member.order ?? 0,
    adult: member.adult ?? false,
    castId: member.cast_id ?? 0,
    creditId: member.credit_id,
    gender: member.gender,
    knownForDepartment: member.known_for_department,
    originalName: member.original_name,
    popularity: member.popularity ?? 0,
  };
}

/**
 * Map a TMDB credits.crew entry (snake_case) onto the local crew columns.
 */
export function mapTmdbCrewMember(
  member: TmdbCrewMember,
): MappedLocalCrewMember {
  return {
    personId: member.id,
    name: member.name,
    job: member.job,
    department: member.department,
    profilePath: member.profile_path,
    adult: member.adult ?? false,
    creditId: member.credit_id,
    gender: member.gender,
    knownForDepartment: member.known_for_department,
    originalName: member.original_name,
    popularity: member.popularity ?? 0,
  };
}

interface TmdbSearchResult {
  id: number;
  title: string;
  release_date?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
  original_title?: string;
  adult?: boolean;
  imdb_id?: string;
  homepage?: string;
  runtime?: number;
  tagline?: string;
  genres?: Array<{ id: number; name: string }>;
  credits?: {
    cast?: TmdbCastMember[];
    crew?: TmdbCrewMember[];
  };
  videos?: {
    results?: Array<{
      id: string;
      key: string;
      name: string;
      site: string;
      type: string;
      official: boolean;
      published_at: string;
      iso_639_1: string;
      iso_3166_1: string;
      size: number;
    }>;
  };
}

/**
 * Rate-limit API calls to avoid hitting free tier limits.
 * Ensures at least MIN_CALL_INTERVAL_MS between requests.
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastCall = now - lastCallTime;
  if (timeSinceLastCall < MIN_CALL_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_CALL_INTERVAL_MS - timeSinceLastCall),
    );
  }
  lastCallTime = Date.now();
}

/**
 * Build a TMDB movie search URL.
 * Year must be a dedicated filter — putting it in `query` (e.g. "Movie 2000")
 * often returns zero results.
 */
export function buildTmdbMovieSearchUrl(
  title: string,
  releaseYear?: number,
): URL {
  const url = new URL("https://api.themoviedb.org/3/search/movie");
  url.searchParams.set("api_key", process.env["TMDB_API_KEY"] ?? "");
  url.searchParams.set("query", title);
  url.searchParams.set("include_adult", "false");

  if (releaseYear) {
    url.searchParams.set("year", String(releaseYear));
  }

  return url;
}

/**
 * Search TMDB for a movie by title and optional year.
 * Returns the first search result with full details, or null if not found.
 */
export async function searchMovieOnTmdb(
  title: string,
  releaseYear?: number,
): Promise<TmdbSearchResult | null> {
  try {
    await rateLimit();

    const url = buildTmdbMovieSearchUrl(title, releaseYear);

    console.log(
      `Searching TMDB for: ${title}${releaseYear ? ` (${releaseYear})` : ""}`,
    );

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`TMDB search failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { results?: TmdbSearchResult[] };
    const result = data.results?.[0];

    if (!result) {
      return null;
    }

    // Fetch full details for the top result
    return await fetchMovieDetailsFromTmdb(result.id);
  } catch (error) {
    console.error("Error searching TMDB:", error);
    return null;
  }
}

/**
 * Fetch full movie details from TMDB including cast, crew, genres, and trailers.
 */
export async function fetchMovieDetailsFromTmdb(
  tmdbId: number,
): Promise<TmdbSearchResult | null> {
  try {
    await rateLimit();

    const url = new URL(`https://api.themoviedb.org/3/movie/${tmdbId}`);
    url.searchParams.set("api_key", process.env["TMDB_API_KEY"] ?? "");
    url.searchParams.set("append_to_response", "credits,videos");

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`TMDB fetch failed: ${response.status}`);
      return null;
    }

    return (await response.json()) as TmdbSearchResult;
  } catch (error) {
    console.error("Error fetching TMDB details:", error);
    return null;
  }
}

export interface TmdbCreatedBy {
  id: number;
  credit_id?: string;
  name: string;
  original_name?: string;
  gender?: number | null;
  profile_path?: string | null;
}

/** Fields returned by GET /tv/{seriesId} without append_to_response. */
export interface TmdbTvDetails {
  id: number;
  name: string;
  original_name?: string;
  overview?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  original_language?: string;
  adult?: boolean;
  homepage?: string | null;
  tagline?: string | null;
  episode_run_time?: number[];
  genres?: Array<{ id: number; name: string }>;
  created_by?: TmdbCreatedBy[];
}

export interface TvSeasonEpisodeDetails {
  episodeNumber: number;
  name: string | null;
  overview: string | null;
  runtimeMinutes: number | null;
  stillPath: string | null;
}

/**
 * Build a TMDB TV search URL.
 * The year filter is first_air_date_year, not the movie `year` parameter.
 */
export function buildTmdbTvSearchUrl(title: string, firstAirYear?: number): URL {
  const url = new URL("https://api.themoviedb.org/3/search/tv");
  url.searchParams.set("api_key", process.env["TMDB_API_KEY"] ?? "");
  url.searchParams.set("query", title);

  if (firstAirYear) {
    url.searchParams.set("first_air_date_year", String(firstAirYear));
  }

  return url;
}

/** GET /tv/{seriesId}. The id comes from the search result. */
export function buildTmdbTvDetailsUrl(tmdbId: number): URL {
  const url = new URL(`https://api.themoviedb.org/3/tv/${tmdbId}`);
  url.searchParams.set("api_key", process.env["TMDB_API_KEY"] ?? "");
  return url;
}

/** GET /tv/{seriesId}/season/{seasonNumber}. */
export function buildTmdbTvSeasonUrl(
  tmdbId: number,
  seasonNumber: number,
): URL {
  const url = new URL(
    `https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}`,
  );
  url.searchParams.set("api_key", process.env["TMDB_API_KEY"] ?? "");
  return url;
}

/**
 * Series details list creators, not a cast or crew credit list.
 * Store each creator as a crew row with the job Creator.
 */
export function mapTmdbCreator(person: TmdbCreatedBy): MappedLocalCrewMember {
  return {
    personId: person.id,
    name: person.name,
    job: "Creator",
    department: "Creator",
    profilePath: person.profile_path,
    adult: false,
    creditId: person.credit_id,
    gender: person.gender,
    knownForDepartment: undefined,
    originalName: person.original_name,
    popularity: 0,
  };
}

/**
 * Search TMDB for a TV series by title and optional first-air year.
 * Returns full details for the top result, or null when nothing matches.
 */
export async function searchTvOnTmdb(
  title: string,
  firstAirYear?: number,
): Promise<TmdbTvDetails | null> {
  try {
    await rateLimit();

    const url = buildTmdbTvSearchUrl(title, firstAirYear);
    console.log(
      `Searching TMDB TV for: ${title}${firstAirYear ? ` (${firstAirYear})` : ""}`,
    );

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`TMDB TV search failed: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as { results?: Array<{ id: number }> };
    const result = data.results?.[0];
    if (!result) {
      return null;
    }

    return await fetchTvDetailsFromTmdb(result.id);
  } catch (error) {
    console.error("Error searching TMDB TV:", error);
    return null;
  }
}

export async function fetchTvDetailsFromTmdb(
  tmdbId: number,
): Promise<TmdbTvDetails | null> {
  try {
    await rateLimit();

    const url = buildTmdbTvDetailsUrl(tmdbId);

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`TMDB TV fetch failed: ${response.status}`);
      return null;
    }

    return (await response.json()) as TmdbTvDetails;
  } catch (error) {
    console.error("Error fetching TMDB TV details:", error);
    return null;
  }
}

/**
 * Episode name, overview, runtime, and still from GET /tv/{id}/season/{n}.
 * An empty list means the season could not be loaded.
 */
export async function fetchTvSeasonDetails(
  tmdbId: number,
  seasonNumber: number,
): Promise<TvSeasonEpisodeDetails[]> {
  try {
    await rateLimit();

    const url = buildTmdbTvSeasonUrl(tmdbId, seasonNumber);
    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error(`TMDB TV season fetch failed: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as {
      episodes?: Array<{
        episode_number?: number;
        name?: string;
        overview?: string;
        runtime?: number | null;
        still_path?: string | null;
      }>;
    };

    const episodes: TvSeasonEpisodeDetails[] = [];
    for (const episode of data.episodes ?? []) {
      if (typeof episode.episode_number !== "number") {
        continue;
      }
      const name = episode.name?.trim() ?? "";
      const overview = episode.overview?.trim() ?? "";
      episodes.push({
        episodeNumber: episode.episode_number,
        name: name.length > 0 ? name : null,
        overview: overview.length > 0 ? overview : null,
        runtimeMinutes:
          typeof episode.runtime === "number" && episode.runtime > 0
            ? episode.runtime
            : null,
        stillPath: episode.still_path?.trim() || null,
      });
    }
    return episodes;
  } catch (error) {
    console.error("Error fetching TMDB TV season:", error);
    return [];
  }
}

/**
 * Extract year from a filename like "Avatar.2009.1080p.BluRay.x264.mkv"
 * Returns the 4-digit year if found, otherwise undefined.
 */
export function extractYearFromFilename(filename: string): number | undefined {
  const match = filename.match(/\b(19\d{2}|20\d{2})\b/);
  if (match && match[1]) {
    return parseInt(match[1], 10);
  }
  return undefined;
}

/**
 * Extract title from filename by removing extension and common patterns.
 * Example: "Avatar.2009.1080p.BluRay.x264.mkv" -> "Avatar"
 */
export function extractTitleFromFilename(filename: string): string {
  // Remove extension
  let title = filename.replace(/\.[^/.]+$/, "");

  // Remove quality/format patterns
  title = title
    .replace(/\d{3,4}p/gi, "") // 720p, 1080p, etc.
    .replace(/BluRay/gi, "")
    .replace(/BRRip/gi, "")
    .replace(/DVDRip/gi, "")
    .replace(/WebRip/gi, "")
    .replace(/x\.?264/gi, "")
    .replace(/x\.?265/gi, "")
    .replace(/HEVC/gi, "")
    .replace(/AAC/gi, "")
    .replace(/\[.*?\]/g, "") // Remove [brackets]
    .replace(/\(.*?\)/g, "") // Remove (parentheses)
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();

  return title;
}
