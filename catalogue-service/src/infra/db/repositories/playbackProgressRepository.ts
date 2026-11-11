import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../client.js";
import {
  localMovies,
  localSeries,
  localSeriesNodes,
  playbackProgress,
  tvPlaybackProgress,
} from "../schema.js";

export interface MoviePlaybackProgress {
  movieId: number;
  progress: number;
  updatedAt: string;
}

function escapeLikePattern(value: string): string {
  return value
    .replace(/!/g, "!!")
    .replace(/%/g, "!%")
    .replace(/_/g, "!_");
}

export function listMoviePlaybackProgress(
  userId: string,
  moviesPath: string,
): MoviePlaybackProgress[] {
  const normalizedPath = moviesPath.replace(/\\/g, "/").replace(/\/?$/, "/");
  const escapedPath = escapeLikePattern(normalizedPath);

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
        sql`${localMovies.url} LIKE ${`${escapedPath}%`} ESCAPE '!'`,
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

export interface TvPlaybackProgress {
  nodeId: number;
  seriesId: number;
  progress: number;
  updatedAt: string;
}

export function listTvPlaybackProgress(
  userId: string,
  tvPath: string,
): TvPlaybackProgress[] {
  const normalizedPath = tvPath.replace(/\\/g, "/").replace(/\/?$/, "/");
  const escapedPath = escapeLikePattern(normalizedPath);

  return db
    .select({
      nodeId: tvPlaybackProgress.nodeId,
      seriesId: localSeriesNodes.seriesId,
      progress: tvPlaybackProgress.progressPercent,
      updatedAt: tvPlaybackProgress.updatedAt,
    })
    .from(tvPlaybackProgress)
    .innerJoin(
      localSeriesNodes,
      eq(tvPlaybackProgress.nodeId, localSeriesNodes.id),
    )
    .innerJoin(localSeries, eq(localSeriesNodes.seriesId, localSeries.id))
    .where(
      and(
        eq(tvPlaybackProgress.userId, userId),
        sql`${localSeries.metadataFile} LIKE ${`${escapedPath}%`} ESCAPE '!'`,
        sql`${localSeriesNodes.url} IS NOT NULL`,
      ),
    )
    .orderBy(desc(tvPlaybackProgress.updatedAt))
    .all();
}

export function upsertTvPlaybackProgress(
  userId: string,
  nodeId: number,
  progress: number,
): { nodeId: number; progress: number; updatedAt: string } {
  const row = db
    .insert(tvPlaybackProgress)
    .values({
      userId,
      nodeId,
      progressPercent: progress,
    })
    .onConflictDoUpdate({
      target: [tvPlaybackProgress.userId, tvPlaybackProgress.nodeId],
      set: {
        progressPercent: progress,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      },
    })
    .returning({
      nodeId: tvPlaybackProgress.nodeId,
      progress: tvPlaybackProgress.progressPercent,
      updatedAt: tvPlaybackProgress.updatedAt,
    })
    .get();

  return row;
}
