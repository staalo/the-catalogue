/**
 * Thin logger wrapper. Fastify's built-in pino logger handles request logging.
 * Use this for non-request contexts (watcher, enrichment, startup).
 */

const level = process.env["LOG_LEVEL"] ?? "info";
const levels = ["error", "warn", "info", "debug"] as const;
type Level = (typeof levels)[number];

function shouldLog(msgLevel: Level): boolean {
  return levels.indexOf(msgLevel) <= levels.indexOf(level as Level);
}

function format(msgLevel: string, msg: string, meta?: unknown): string {
  const ts = new Date().toISOString();
  const extra = meta !== undefined ? ` ${JSON.stringify(meta)}` : "";
  return `[${ts}] ${msgLevel.toUpperCase()} ${msg}${extra}`;
}

export const logger = {
  error: (msg: string, meta?: unknown) => {
    if (shouldLog("error")) console.error(format("error", msg, meta));
  },
  warn: (msg: string, meta?: unknown) => {
    if (shouldLog("warn")) console.warn(format("warn", msg, meta));
  },
  info: (msg: string, meta?: unknown) => {
    if (shouldLog("info")) console.log(format("info", msg, meta));
  },
  debug: (msg: string, meta?: unknown) => {
    if (shouldLog("debug")) console.log(format("debug", msg, meta));
  },
};
