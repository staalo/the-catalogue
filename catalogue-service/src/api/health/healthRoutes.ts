import type { FastifyInstance } from "fastify";

/**
 * Liveness check at GET /ping.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ping", async (_request, reply) => {
    return reply.send("Ping OK!");
  });
}
