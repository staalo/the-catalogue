import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../modules/auth/middleware.js";
import {
  browseMovies,
  browseTv,
  getSeriesDetail,
} from "../../modules/browse/browseService.js";

interface BrowseQuery {
  page?: number;
}

/**
 * Browse routes. Authentication is required.
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

  app.get<{ Params: { seriesId: string } }>(
    "/api/browse/tv/:seriesId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const seriesId = Number(request.params.seriesId);
      if (!Number.isInteger(seriesId) || seriesId <= 0) {
        return reply
          .status(400)
          .send({ error: "Series ID must be a positive integer." });
      }

      const detail = await getSeriesDetail(seriesId);
      if (!detail) {
        return reply.status(404).send({ error: "TV series not found." });
      }

      return reply.send(detail);
    },
  );
}
