import { config } from "../../app/config.js";

export interface MediaPaths {
  moviesPath: string | null;
  tvPath: string | null;
}

/** Deployment-level media roots shared by every user. */
export function getMediaPaths(): MediaPaths {
  return {
    moviesPath: config.sharedMoviesPath,
    tvPath: config.sharedTvPath,
  };
}