import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../../modules/auth/middleware.js";
import {
  tryGetMovieStream,
  tryGetMovieAssetStream,
  tryGetExtraStream,
  tryGetExtraAssetStream,
  tryGetTvNodeStream,
  tryGetTvNodeAssetStream,
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
 * Stream routes. Every route requires authentication.
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

      const [status, file] = await tryGetMovieStream(movieId);

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

      const [status, file] = await tryGetExtraStream(movieId, extraId);

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

      const [status, file] = await tryGetExtraAssetStream(
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

      const [status, file] = await tryGetMovieAssetStream(
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

  app.get<{ Params: { seriesId: string; nodeId: string } }>(
    "/api/stream/tv/:seriesId/nodes/:nodeId",
    { preHandler: requireAuth },
    async (request, reply) => {
      const seriesId = parseInt(request.params.seriesId, 10);
      const nodeId = parseInt(request.params.nodeId, 10);
      if (isNaN(seriesId) || isNaN(nodeId)) {
        return reply
          .status(400)
          .send({ error: "Invalid seriesId or nodeId" });
      }

      const [status, file] = await tryGetTvNodeStream(seriesId, nodeId);
      if (status === StreamStatus.NotFound) {
        return reply.status(404).send({ error: "TV item not found" });
      }
      if (status === StreamStatus.Forbidden) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      return sendStreamFile(request, reply, file!);
    },
  );

  app.get<{ Params: { seriesId: string; nodeId: string; "*": string } }>(
    "/api/stream/tv/:seriesId/nodes/:nodeId/*",
    { preHandler: requireAuth },
    async (request, reply) => {
      const seriesId = parseInt(request.params.seriesId, 10);
      const nodeId = parseInt(request.params.nodeId, 10);
      const relativePath = (request.params as { "*": string })["*"] || "";
      if (isNaN(seriesId) || isNaN(nodeId) || !relativePath) {
        return reply.status(400).send({ error: "Invalid parameters" });
      }

      const [status, file] = await tryGetTvNodeAssetStream(
        seriesId,
        nodeId,
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
