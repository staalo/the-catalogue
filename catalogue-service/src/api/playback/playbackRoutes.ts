import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../modules/auth/middleware.js";
import {
  getMoviePlaybackProgress,
  getTvPlaybackProgress,
  saveMoviePlaybackProgress,
  saveTvPlaybackProgress,
} from "../../modules/playback/playbackProgressService.js";

interface MovieParams {
  movieId: string;
}

interface TvNodeParams {
  nodeId: string;
}

interface ProgressBody {
  progress?: number;
}

export async function playbackRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/playback/movies",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.session.userId;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      return reply.send(getMoviePlaybackProgress(userId));
    },
  );

  app.put<{ Params: MovieParams; Body: ProgressBody }>(
    "/api/playback/movies/:movieId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.session.userId;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const movieId = Number(request.params.movieId);
      const progress = request.body?.progress;
      if (!Number.isInteger(movieId) || movieId <= 0) {
        return reply
          .status(400)
          .send({ error: "Movie ID must be a positive integer." });
      }
      if (typeof progress !== "number" || !Number.isFinite(progress)) {
        return reply
          .status(400)
          .send({ error: "Progress must be a finite number." });
      }

      const result = await saveMoviePlaybackProgress(
        userId,
        movieId,
        progress,
      );

      return reply.send(result);
    },
  );

  app.get(
    "/api/playback/tv",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.session.userId;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      return reply.send(getTvPlaybackProgress(userId));
    },
  );

  app.put<{ Params: TvNodeParams; Body: ProgressBody }>(
    "/api/playback/tv/:nodeId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = request.session.userId;
      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const nodeId = Number(request.params.nodeId);
      const progress = request.body?.progress;
      if (!Number.isInteger(nodeId) || nodeId <= 0) {
        return reply
          .status(400)
          .send({ error: "Node ID must be a positive integer." });
      }
      if (typeof progress !== "number" || !Number.isFinite(progress)) {
        return reply
          .status(400)
          .send({ error: "Progress must be a finite number." });
      }

      return reply.send(saveTvPlaybackProgress(userId, nodeId, progress));
    },
  );
}
