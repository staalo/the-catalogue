import { desc, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import { playbackProgress } from "../schema.js";

export interface MoviePlaybackProgress {
  movieId: number;
  progress: number;
  updatedAt: string;
}

export function listMoviePlaybackProgress(
  userId: string,
): MoviePlaybackProgress[] {
  return db
    .select({
      movieId: playbackProgress.localMovieId,
      progress: playbackProgress.progressPercent,
      updatedAt: playbackProgress.updatedAt,
    })
    .from(playbackProgress)
    .where(eq(playbackProgress.userId, userId))
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
