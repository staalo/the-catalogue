import { existsSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyRequest } from "fastify";
import fastifyStatic from "@fastify/static";

const API_EXACT_PATHS = new Set([
  "/ping",
  "/register",
  "/userlogin",
  "/logout",
  "/getcurrentuser",
  "/pingauth",
]);

export function resolvePublicDir(configured: string | null): string | null {
  const dir = configured?.trim();
  if (!dir) {
    return null;
  }

  return existsSync(path.join(dir, "index.html")) ? dir : null;
}

function requestPath(request: FastifyRequest): string {
  const url = request.raw.url ?? request.url;
  const queryIndex = url.indexOf("?");
  const pathname = queryIndex === -1 ? url : url.slice(0, queryIndex);
  return pathname || "/";
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/") || API_EXACT_PATHS.has(pathname);
}

export async function registerUiStatic(
  app: FastifyInstance,
  publicDir: string,
): Promise<void> {
  await app.register(fastifyStatic, {
    root: publicDir,
    index: ["index.html"],
    wildcard: false,
  });

  app.setNotFoundHandler((request, reply) => {
    const pathname = requestPath(request);
    const isGet = request.method === "GET" || request.method === "HEAD";
    if (isGet && !isApiPath(pathname)) {
      return reply.sendFile("index.html");
    }

    return reply.status(404).send({ error: "Not Found" });
  });
}
