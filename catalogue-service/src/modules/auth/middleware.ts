import type { FastifyRequest, FastifyReply } from "fastify";
import "./types.js";

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
