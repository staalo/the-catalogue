import type { FastifyInstance } from "fastify";

/**
 * Health routes — mirrors .NET's GET /ping endpoint.
 */
export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ping", async (_request, reply) => {
    return reply.send("Ping OK!");
  });
}
