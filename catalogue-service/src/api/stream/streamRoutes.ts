import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../modules/auth/middleware.js";
import {
  tryGetMovieStream,
  tryGetMovieAssetStream,
  tryGetExtraStream,
  tryGetExtraAssetStream,
  StreamStatus,
  type StreamFile,
} from "../../modules/stream/streamService.js";
import { sendRangedFile } from "../../modules/stream/rangeStream.js";

function sendStreamFile(
  request: FastifyRequest,
  reply: FastifyReply,
  file: StreamFile,
): Promise<FastifyReply> {
  return sendRangedFile(
    reply,
    file.filePath,
    file.contentType,
    request.headers.range,
  );
}

/**
 * Stream routes — mirrors StreamController.cs
 * All routes require authentication
 */
export async function registerStreamRoutes(
  app: FastifyInstance,
): Promise<void> {
  // GET /api/stream/movies/{movieId}
  app.get<{ Params: { movieId: string } }>(
    "/api/stream/movies/:movieId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const movieId = parseInt(request.params.movieId, 10);
      if (isNaN(movieId)) {
        return reply.status(400).send({ error: "Invalid movieId" });
      }

      const userName = request.session.userName ?? request.session.email;
      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const [status, file] = await tryGetMovieStream(userName, movieId);

      if (status === StreamStatus.NotFound) {
        return reply.status(404).send({ error: "Movie not found" });
      }
      if (status === StreamStatus.Forbidden) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      return sendStreamFile(request, reply, file!);
    },
  );

  // GET /api/stream/movies/{movieId}/extras/{extraId}
  app.get<{ Params: { movieId: string; extraId: string } }>(
    "/api/stream/movies/:movieId/extras/:extraId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const movieId = parseInt(request.params.movieId, 10);
      const extraId = parseInt(request.params.extraId, 10);

      if (isNaN(movieId) || isNaN(extraId)) {
        return reply.status(400).send({ error: "Invalid movieId or extraId" });
      }

      const userName = request.session.userName ?? request.session.email;
      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const [status, file] = await tryGetExtraStream(
        userName,
        movieId,
        extraId,
      );

      if (status === StreamStatus.NotFound) {
        return reply.status(404).send({ error: "Extra not found" });
      }
      if (status === StreamStatus.Forbidden) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      return sendStreamFile(request, reply, file!);
    },
  );

  // GET /api/stream/movies/{movieId}/extras/{extraId}/* (catch-all for assets)
  app.get<{ Params: { movieId: string; extraId: string; "*": string } }>(
    "/api/stream/movies/:movieId/extras/:extraId/*",
    { preHandler: requireAuth },
    async (request, reply) => {
      const movieId = parseInt(request.params.movieId, 10);
      const extraId = parseInt(request.params.extraId, 10);
      const relativePath = (request.params as any)["*"] || "";

      if (isNaN(movieId) || isNaN(extraId) || !relativePath) {
        return reply.status(400).send({ error: "Invalid parameters" });
      }

      const userName = request.session.userName ?? request.session.email;
      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const [status, file] = await tryGetExtraAssetStream(
        userName,
        movieId,
        extraId,
        relativePath,
      );

      if (status === StreamStatus.NotFound) {
        return reply.status(404).send({ error: "Asset not found" });
      }
      if (status === StreamStatus.Forbidden) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      return sendStreamFile(request, reply, file!);
    },
  );

  // GET /api/stream/movies/{movieId}/* (catch-all for assets)
  app.get<{ Params: { movieId: string; "*": string } }>(
    "/api/stream/movies/:movieId/*",
    { preHandler: requireAuth },
    async (request, reply) => {
      const movieId = parseInt(request.params.movieId, 10);
      const relativePath = (request.params as any)["*"] || "";

      if (isNaN(movieId) || !relativePath) {
        return reply.status(400).send({ error: "Invalid parameters" });
      }

      const userName = request.session.userName ?? request.session.email;
      if (!userName) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const [status, file] = await tryGetMovieAssetStream(
        userName,
        movieId,
        relativePath,
      );

      if (status === StreamStatus.NotFound) {
        return reply.status(404).send({ error: "Asset not found" });
      }
      if (status === StreamStatus.Forbidden) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      return sendStreamFile(request, reply, file!);
    },
  );
}
