import path from "node:path";
import { stat } from "node:fs/promises";
import {
  getOwnMediaPaths,
  upsertMediaPaths,
  type MediaPaths,
} from "../../infra/db/repositories/localMediaRepository.js";
import { BadRequestError } from "../../shared/errors/AppError.js";

export async function resolveExistingDirectory(dirPath: string): Promise<string> {
  const trimmed = dirPath.trim();
  if (trimmed === "") {
    throw new BadRequestError("Media path must not be empty");
  }

  if (!path.isAbsolute(trimmed)) {
    throw new BadRequestError("Media path must be an absolute directory");
  }

  const resolved = path.resolve(trimmed);

  try {
    const info = await stat(resolved);
    if (!info.isDirectory()) {
      throw new BadRequestError("Media path must be a directory");
    }
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new BadRequestError("Media path does not exist or is not accessible");
  }

  return resolved;
}

export function getMediaPathsForUser(userName: string): MediaPaths {
  return getOwnMediaPaths(userName);
}

export async function updateMediaPathsForUser(
  userName: string,
  patch: { moviesPath?: string | null | undefined; tvPath?: string | null | undefined },
): Promise<MediaPaths> {
  if (patch.moviesPath === undefined && patch.tvPath === undefined) {
    throw new BadRequestError("moviesPath or tvPath is required");
  }

  const moviesPath =
    patch.moviesPath === undefined
      ? undefined
      : patch.moviesPath === null || patch.moviesPath.trim() === ""
        ? null
        : await resolveExistingDirectory(patch.moviesPath);

  const tvPath =
    patch.tvPath === undefined
      ? undefined
      : patch.tvPath === null || patch.tvPath.trim() === ""
        ? null
        : await resolveExistingDirectory(patch.tvPath);

  return upsertMediaPaths(userName, { moviesPath, tvPath });
}