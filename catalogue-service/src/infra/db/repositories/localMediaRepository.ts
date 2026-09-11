import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { localMedia } from "../schema.js";

export interface MediaPaths {
  moviesPath: string | null;
  tvPath: string | null;
}

/** Returns the media paths row for this user only — no cross-user fallback. */
export function getOwnMediaPaths(userName: string): MediaPaths {
  const row = db
    .select({ moviesPath: localMedia.moviesPath, tvPath: localMedia.tvPath })
    .from(localMedia)
    .where(eq(localMedia.userName, userName))
    .get();

  return row ?? { moviesPath: null, tvPath: null };
}

export function upsertMediaPaths(
  userName: string,
  paths: { moviesPath?: string | null | undefined; tvPath?: string | null | undefined },
): MediaPaths {
  const existing = db
    .select({
      id: localMedia.id,
      moviesPath: localMedia.moviesPath,
      tvPath: localMedia.tvPath,
    })
    .from(localMedia)
    .where(eq(localMedia.userName, userName))
    .get();

  const moviesPath =
    paths.moviesPath !== undefined ? paths.moviesPath : (existing?.moviesPath ?? null);
  const tvPath =
    paths.tvPath !== undefined ? paths.tvPath : (existing?.tvPath ?? null);

  if (existing) {
    db.update(localMedia)
      .set({ moviesPath, tvPath })
      .where(eq(localMedia.userName, userName))
      .run();
  } else {
    db.insert(localMedia)
      .values({ userName, moviesPath, tvPath })
      .run();
  }

  return { moviesPath, tvPath };
}

/** Returns the configured media root paths for a user, or null if not found. */
export function getMediaPaths(userName: string): MediaPaths | null {
  const row = db
    .select({ moviesPath: localMedia.moviesPath, tvPath: localMedia.tvPath })
    .from(localMedia)
    .where(eq(localMedia.userName, userName))
    .get();

  if (row) {
    return row;
  }

  // Fresh DB fallback: allow the service to use the startup-seeded media paths.
  const fallback = db
    .select({ moviesPath: localMedia.moviesPath, tvPath: localMedia.tvPath })
    .from(localMedia)
    .limit(1)
    .get();

  return fallback ?? null;
}
