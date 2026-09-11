import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../modules/auth/middleware.js";
import {
  getMediaPathsForUser,
  updateMediaPathsForUser,
} from "../../modules/media-paths/mediaPathService.js";
import { AppError } from "../../shared/errors/AppError.js";

interface MediaPathsBody {
  moviesPath?: string | null | undefined;
  tvPath?: string | null | undefined;
}

function sessionUserName(request: {
  session: { userName?: string; email?: string };
}): string | undefined {
  return request.session.userName ?? request.session.email;
}

/**
 * Media path routes — per-user movies/TV library roots.
 *   GET  /api/media/paths  (auth required)
 *   PUT  /api/media/paths  (auth required)
 */
export async function registerMediaPathRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/api/media/paths",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userName = sessionUserName(request);
      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      return reply.send(getMediaPathsForUser(userName));
    },
  );

  app.put<{ Body: MediaPathsBody }>(
    "/api/media/paths",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userName = sessionUserName(request);
      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      try {
        const paths = await updateMediaPathsForUser(
          userName,
          request.body ?? {},
        );
        return reply.send(paths);
      } catch (err) {
        if (err instanceof AppError) {
          return reply.status(err.statusCode).send({ error: err.message });
        }
        throw err;
      }
    },
  );
}
