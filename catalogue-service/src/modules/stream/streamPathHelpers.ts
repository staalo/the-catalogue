import path from "node:path";
import fs from "node:fs/promises";

/**
 * Security: Allowed file extensions for streaming.
 * Mirrors MediaStreamPathHelper.cs
 */
const ALLOWED_EXTENSIONS = new Set([
  ".mp4",
  ".m3u8",
  ".mkv",
  ".m4s",
  ".vtt",
  ".webm",
  ".avi",
  ".mov",
  ".m4v",
]);

/**
 * Content type mapping.
 * Mirrors MediaStreamPathHelper.cs
 */
const CONTENT_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m3u8": "application/vnd.apple.mpegurl",
  ".m4v": "video/mp4",
  ".m4s": "video/mp4",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mov": "video/quicktime",
  ".vtt": "text/vtt",
};

/**
 * Validates that a file path is under an authorized directory.
 * Prevents path traversal attacks.
 */
export function isPathUnderDirectory(
  filePath: string,
  directoryPath: string,
): boolean {
  const fullFilePath = path.resolve(filePath);
  let fullDirectoryPath = path.resolve(directoryPath);

  if (!fullDirectoryPath.endsWith(path.sep)) {
    fullDirectoryPath += path.sep;
  }

  return fullFilePath.startsWith(fullDirectoryPath);
}

/**
 * Gets the MIME type for a file extension.
 * Returns null if extension is not in the allowed list.
 */
export function getContentType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return null;
  }

  return CONTENT_TYPES[ext] || "application/octet-stream";
}

/**
 * Resolves a relative asset path safely.
 * Prevents directory traversal attacks (.. and .).
 */
export function tryResolveAssetPath(
  baseDirectory: string,
  relativePath: string,
  moviesPath: string,
): string | null {
  if (!relativePath || relativePath.trim() === "") {
    return null;
  }

  // Reject absolute paths
  if (path.isAbsolute(relativePath)) {
    return null;
  }

  // Normalize and split path
  const normalizedRelativePath = relativePath.replace(/\\/g, "/");
  const segments = normalizedRelativePath
    .split("/")
    .filter((s) => s.length > 0);

  // Reject empty or suspicious segments (. and ..)
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === "." || segment === "..")
  ) {
    return null;
  }

  // Combine and resolve
  const combinedPath = segments.reduce(
    (acc, segment) => path.join(acc, segment),
    baseDirectory,
  );
  const fullPath = path.resolve(combinedPath);

  let fullBaseDirectory = path.resolve(baseDirectory);
  if (!fullBaseDirectory.endsWith(path.sep)) {
    fullBaseDirectory += path.sep;
  }

  // Check if resolved path is under the base directory
  if (!fullPath.startsWith(fullBaseDirectory)) {
    return null;
  }

  // Check if resolved path is under the authorized movies directory
  if (!isPathUnderDirectory(fullPath, moviesPath)) {
    return null;
  }

  return fullPath;
}

/**
 * Checks if a file exists.
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}
