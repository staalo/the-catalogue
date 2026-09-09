import { eq } from "drizzle-orm";
import { db } from "../client.js";
import { localMedia } from "../schema.js";

export interface MediaPaths {
  moviesPath: string | null;
  tvPath: string | null;
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
