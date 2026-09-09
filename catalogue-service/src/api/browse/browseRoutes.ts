import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../modules/auth/middleware.js";
import { browseMovies } from "../../modules/browse/browseService.js";

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
      const userName = request.session.userName ?? request.session.email;

      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const page = Math.max(1, Number(request.query.page) || 1);
      const result = await browseMovies(userName, page);

      if (result.results.length === 0) {
        return reply
          .status(404)
          .send({ error: "No movies found in the configured directory." });
      }

      return reply.send(result);
    },
  );
}
