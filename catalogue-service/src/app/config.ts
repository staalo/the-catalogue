import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;
const DEFAULT_REMEMBER_ME_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const sessionSecret = process.env["SESSION_SECRET"] ?? "";

if (sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be at least 32 characters. Set it in .env before starting.",
  );
}

function readDurationMs(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) {
    return fallback;
  }

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${name} must be a positive number of milliseconds.`);
  }

  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive number of milliseconds.`);
  }

  return value;
}

export const config = {
  port: parseInt(process.env["PORT"] ?? "3000", 10),
  databaseUrl: process.env["DATABASE_URL"] ?? "./data/catalog.db",
  sessionSecret,
  sharedMoviesPath:
    process.env["MOVIES_PATH"] ?? process.env["MEDIA_MOVIES_PATH"] ?? null,
  sharedTvPath:
    process.env["TV_PATH"] ?? process.env["MEDIA_TV_PATH"] ?? null,
  publicDir:
    process.env["PUBLIC_DIR"] ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public"),
  /** Session TTL in milliseconds. SESSION_TTL_MS, default 60 minutes. */
  sessionTtlMs: readDurationMs("SESSION_TTL_MS", DEFAULT_SESSION_TTL_MS),
  /** Remember-me TTL in milliseconds. REMEMBER_ME_TTL_MS, default 30 days. */
  rememberMeTtlMs: readDurationMs(
    "REMEMBER_ME_TTL_MS",
    DEFAULT_REMEMBER_ME_TTL_MS,
  ),
  isDev: process.env["NODE_ENV"] !== "production",
};
