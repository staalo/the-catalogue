import { ilike } from "drizzle-orm";
import { db } from "../client.js";
import { localMovies } from "../schema.js";
import type { MovieWithRelations } from "./localMovieRepository.js";

/**
 * Search local movies by title (case-insensitive LIKE).
 * Returns all matching movies with their relations.
 */
export async function searchMoviesByTitle(
  query: string,
): Promise<MovieWithRelations[]> {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const pattern = `%${query.trim()}%`;

  return (await db.query.localMovies.findMany({
    with: {
      cast: true,
      crew: true,
      genres: true,
      extras: true,
      trailer: true,
    },
    where: (m, { like: lk }) => lk(m.title, pattern),
    orderBy: (m, { asc }) => [asc(m.title)],
    limit: 100, // Reasonable limit for search results
  })) as MovieWithRelations[];
}
