import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const sessionSecret = process.env["SESSION_SECRET"] ?? "";

if (sessionSecret.length < 32) {
  throw new Error(
    "SESSION_SECRET must be at least 32 characters. Set it in .env before starting.",
  );
}

export const config = {
  port: parseInt(process.env["PORT"] ?? "3000", 10),
  databaseUrl: process.env["DATABASE_URL"] ?? "./data/catalog.db",
  sessionSecret,
  defaultMoviesPath:
    process.env["MOVIES_PATH"] ?? process.env["MEDIA_MOVIES_PATH"] ?? null,
  defaultTvPath:
    process.env["TV_PATH"] ?? process.env["MEDIA_TV_PATH"] ?? null,
  mediaBootstrapUser: process.env["MEDIA_BOOTSTRAP_USER"] ?? "system",
  publicDir:
    process.env["PUBLIC_DIR"] ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public"),
  /** Session TTL in milliseconds — mirrors .NET's 60-minute sliding expiration */
  sessionTtlMs: 60 * 60 * 1000,
  /** Persistent session TTL when the user checks Remember me */
  rememberMeTtlMs: 30 * 24 * 60 * 60 * 1000,
  isDev: process.env["NODE_ENV"] !== "production",
};
