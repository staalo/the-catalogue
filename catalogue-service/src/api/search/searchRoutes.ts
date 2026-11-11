import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../modules/auth/middleware.js";
import { searchMovies, searchTv } from "../../modules/search/searchService.js";

export async function registerSearchRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: { q: string } }>(
    "/api/search/movies",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { q } = request.query;

      // Validate query parameter
      if (!q || q.trim().length === 0) {
        return reply.status(400).send({
          error: 'Query parameter "q" is required and must not be empty',
        });
      }

      const result = await searchMovies(q);

      if (result.totalResults === 0) {
        return reply.status(404).send({
          error: `No movies found matching "${q}"`,
        });
      }

      return reply.send(result);
    },
  );

  fastify.get<{ Querystring: { q: string } }>(
    "/api/search/tv",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { q } = request.query;

      if (!q || q.trim().length === 0) {
        return reply.status(400).send({
          error: 'Query parameter "q" is required and must not be empty',
        });
      }

      const result = await searchTv(q);

      if (result.totalResults === 0) {
        return reply.status(404).send({
          error: `No TV series found matching "${q}"`,
        });
      }

      return reply.send(result);
    },
  );
}
