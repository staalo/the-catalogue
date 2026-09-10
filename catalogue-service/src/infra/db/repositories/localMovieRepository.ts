import { like, sql } from "drizzle-orm";
import { db } from "../client.js";
import { localMovies } from "../schema.js";
import type { InferSelectModel } from "drizzle-orm";
import type {
  localMovieCast,
  localMovieCrew,
  localMovieGenres,
  localMovieExtras,
  localMovieTrailers,
} from "../schema.js";

export interface MovieWithRelations extends InferSelectModel<
  typeof localMovies
> {
  cast: InferSelectModel<typeof localMovieCast>[];
  crew: InferSelectModel<typeof localMovieCrew>[];
  genres: InferSelectModel<typeof localMovieGenres>[];
  extras: InferSelectModel<typeof localMovieExtras>[];
  trailer: InferSelectModel<typeof localMovieTrailers> | null;
}

/** Stream lookups only need the movie row plus extras — not cast/crew/genres/trailer. */
export type MovieWithExtras = InferSelectModel<typeof localMovies> & {
  extras: InferSelectModel<typeof localMovieExtras>[];
};

const PAGE_SIZE = 20;

/**
 * Paginated browse query — mirrors LocalMovieRepository.GetByDirectoryPaginatedAsync.
 * Includes all relations (cast, crew, genres, extras, trailer) via the Drizzle
 * relational query API. Results are ordered by title.
 */
export async function getMoviesPaginated(
  directoryPath: string,
  page: number,
): Promise<{ movies: MovieWithRelations[]; totalCount: number }> {
  const normalizedPath = directoryPath.replace(/\\/g, "/").replace(/\/?$/, "/");
  const pattern = `${normalizedPath}%`;
  const offset = (page - 1) * PAGE_SIZE;

  const totalCount =
    db
      .select({ count: sql<number>`count(*)` })
      .from(localMovies)
      .where(like(localMovies.url, pattern))
      .get()?.count ?? 0;

  const movies = (await db.query.localMovies.findMany({
    with: {
      cast: true,
      crew: true,
      genres: true,
      extras: true,
      trailer: true,
    },
    where: (m, { like: lk }) => lk(m.url, pattern),
    orderBy: (m, { asc }) => [asc(m.title)],
    limit: PAGE_SIZE,
    offset,
  })) as MovieWithRelations[];

  return { movies, totalCount };
}

/** Fetch a single movie with extras only (used by the stream module). */
export async function getMovieById(
  id: number,
): Promise<MovieWithExtras | undefined> {
  return (await db.query.localMovies.findFirst({
    with: { extras: true },
    where: (m, { eq }) => eq(m.id, id),
  })) as MovieWithExtras | undefined;
}

/** Fetch a single movie by its file URL (used by the watcher). */
export async function getMovieByUrl(
  url: string,
): Promise<MovieWithRelations | undefined> {
  return (await db.query.localMovies.findFirst({
    with: { cast: true, crew: true, genres: true, extras: true, trailer: true },
    where: (m, { eq }) => eq(m.url, url),
  })) as MovieWithRelations | undefined;
}
