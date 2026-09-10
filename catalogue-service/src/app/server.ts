import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import fastifyCors from "@fastify/cors";
import { config } from "./config.js";
import { authRoutes } from "../api/auth/authRoutes.js";
import { healthRoutes } from "../api/health/healthRoutes.js";
import { browseRoutes } from "../api/browse/browseRoutes.js";
import { registerSearchRoutes } from "../api/search/searchRoutes.js";
import { registerStreamRoutes } from "../api/stream/streamRoutes.js";
import { registerMediaWatcherRoutes } from "../api/admin/mediaWatcherRoutes.js";
import { AppError } from "../shared/errors/AppError.js";
import { skipUnmodifiedSessionSave } from "../modules/auth/middleware.js";
import {
  setupFileWatchers,
  stopAllWatchers,
} from "../modules/media-watcher/index.js";

function isLocalOrLanOrigin(origin: string): boolean {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return true;

  const parts = url.hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return false;

  const [a, b] = parts as [number, number, number, number];

  return (
    a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
  );
}

export async function buildServer() {
  const app = Fastify({ logger: config.isDev });

  await app.register(fastifyCookie);

  // Fastify runs onSend in registration order. This must run before
  // @fastify/session so media GETs skip the rolling store write + Set-Cookie,
  // except when the cookie is close to expiry.
  app.addHook("onSend", skipUnmodifiedSessionSave);

  await app.register(fastifySession, {
    secret: config.sessionSecret,
    cookieName: "sessionId",
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: config.sessionTtlMs,
    },
    rolling: true,
  });

  await app.register(fastifyCors, {
    origin: (origin, cb) => {
      if (!origin || isLocalOrLanOrigin(origin)) {
        cb(null, true);
      } else {
        cb(new Error("CORS: origin not allowed"), false);
      }
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "Range"],
    exposedHeaders: [
      "Accept-Ranges",
      "Content-Range",
      "Content-Length",
      "Content-Type",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({ error: error.message });
    }

    app.log.error(error);
    return reply.status(500).send({ error: "Internal Server Error" });
  });

  await app.register(healthRoutes);
  await app.register(authRoutes);
  await app.register(browseRoutes);
  await app.register(registerSearchRoutes);
  await app.register(registerStreamRoutes);
  await app.register(registerMediaWatcherRoutes);

  try {
    await setupFileWatchers();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Failed to initialize file watchers:", errorMsg);
  }

  app.addHook("onClose", async () => {
    await stopAllWatchers();
  });

  return app;
}
