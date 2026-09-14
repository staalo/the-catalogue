import { and, desc, eq, like, sql } from "drizzle-orm";
import { db } from "../client.js";
import { localMovies, playbackProgress } from "../schema.js";

export interface MoviePlaybackProgress {
  movieId: number;
  progress: number;
  updatedAt: string;
}

export function listMoviePlaybackProgress(
  userId: string,
  moviesPath: string,
): MoviePlaybackProgress[] {
  const normalizedPath = moviesPath.replace(/\\/g, "/").replace(/\/?$/, "/");

  return db
    .select({
      movieId: playbackProgress.localMovieId,
      progress: playbackProgress.progressPercent,
      updatedAt: playbackProgress.updatedAt,
    })
    .from(playbackProgress)
    .innerJoin(
      localMovies,
      eq(playbackProgress.localMovieId, localMovies.id),
    )
    .where(
      and(
        eq(playbackProgress.userId, userId),
        like(localMovies.url, `${normalizedPath}%`),
      ),
    )
    .orderBy(desc(playbackProgress.updatedAt))
    .all();
}

export function upsertMoviePlaybackProgress(
  userId: string,
  movieId: number,
  progress: number,
): MoviePlaybackProgress {
  const row = db
    .insert(playbackProgress)
    .values({
      userId,
      localMovieId: movieId,
      progressPercent: progress,
    })
    .onConflictDoUpdate({
      target: [playbackProgress.userId, playbackProgress.localMovieId],
      set: {
        progressPercent: progress,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .returning({
      movieId: playbackProgress.localMovieId,
      progress: playbackProgress.progressPercent,
      updatedAt: playbackProgress.updatedAt,
    })
    .get();

  return row;
}
