import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../modules/auth/middleware.js";
import { browseMovies, browseTv } from "../../modules/browse/browseService.js";

interface BrowseQuery {
  page?: number;
}

/**
 * Browse routes — mirrors BrowseController.cs:
 *   GET /api/browse/browsemovies?page=1  (auth required)
 */
export async function browseRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: BrowseQuery }>(
    "/api/browse/browsemovies",
    { preHandler: requireAuth },
    async (request, reply) => {
      const page = Math.max(1, Number(request.query.page) || 1);
      const result = await browseMovies(page);

      if (result.results.length === 0) {
        return reply
          .status(404)
          .send({ error: "No movies found in the configured directory." });
      }

      return reply.send(result);
    },
  );

  app.get<{ Querystring: BrowseQuery }>(
    "/api/browse/browsetv",
    { preHandler: requireAuth },
    async (request, reply) => {
      const page = Math.max(1, Number(request.query.page) || 1);
      return reply.send(await browseTv(page));
    },
  );
}
