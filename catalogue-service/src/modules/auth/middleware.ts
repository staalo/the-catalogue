import type { FastifyRequest, FastifyReply } from "fastify";
import "./types.js";

/** Rolling-save a stream GET only when the cookie has this much life left. */
export const STREAM_SESSION_RENEW_WINDOW_MS = 10 * 60 * 1000;

/**
 * Fastify preHandler hook — enforces an authenticated session.
 * Mirrors .NET's RequireAuthorization() on protected endpoints.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.session.userId) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
}

type SessionCookieExpiry = {
  originalExpires?: Date | string;
  expires?: Date | string | null;
};

/**
 * True when the persisted cookie expires within the renew window.
 * Uses originalExpires because @fastify/session resets cookie.expires on restore.
 */
export function sessionCookieNeedsRenewal(
  cookie: SessionCookieExpiry | undefined,
  nowMs: number = Date.now(),
  windowMs: number = STREAM_SESSION_RENEW_WINDOW_MS,
): boolean {
  if (!cookie) {
    return false;
  }

  const raw = cookie.originalExpires ?? cookie.expires;
  if (raw == null) {
    return false;
  }

  const expiresAt =
    raw instanceof Date ? raw.getTime() : Date.parse(String(raw));
  if (Number.isNaN(expiresAt)) {
    return false;
  }

  return expiresAt - nowMs <= windowMs;
}

/**
 * Drop the session on the way out so @fastify/session does not save or
 * rewrite the cookie. Auth already ran; HLS segment GETs should not pay
 * rolling-session TTFB on every media chunk.
 *
 * If the cookie is close to expiry, leave the session in place so rolling
 * can refresh it and a long movie does not log the user out.
 *
 * Must be registered *before* @fastify/session — Fastify runs onSend
 * hooks in registration order.
 */
export async function skipUnmodifiedSessionSave(
  request: FastifyRequest,
): Promise<void> {
  if (!isStreamGet(request)) {
    return;
  }

  if (sessionCookieNeedsRenewal(request.session.cookie)) {
    return;
  }

  (request as { session: FastifyRequest["session"] | null }).session = null;
}

function isStreamGet(request: FastifyRequest): boolean {
  if (request.method !== "GET") {
    return false;
  }

  const path = request.raw.url?.split("?", 1)[0] ?? "";
  return path === "/api/stream" || path.startsWith("/api/stream/");
}
