import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requireAuth,
  sessionCookieNeedsRenewal,
  skipUnmodifiedSessionSave,
  STREAM_SESSION_RENEW_WINDOW_MS,
} from "../../src/modules/auth/middleware.js";

function firstCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first ?? "").split(";")[0] ?? "";
}

describe("requireAuth", () => {
  it("sends 401 and does not run the route handler without a session userId", async () => {
    const app = Fastify();
    let handlerRan = false;

    app.addHook("onRequest", async (request) => {
      (request as { session?: { userId?: string } }).session ??= {};
    });

    app.get(
      "/protected",
      { preHandler: requireAuth },
      async (_request, reply) => {
        handlerRan = true;
        return reply.send({ ok: true });
      },
    );

    const res = await app.inject({ method: "GET", url: "/protected" });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "Unauthorized" });
    expect(handlerRan).toBe(false);

    await app.close();
  });

  it("runs the route handler when session has a userId", async () => {
    const app = Fastify();
    let handlerRan = false;

    app.addHook("onRequest", async (request) => {
      (request as { session?: { userId?: string } }).session = {
        userId: "u-1",
      };
    });

    app.get(
      "/protected",
      { preHandler: requireAuth },
      async (_request, reply) => {
        handlerRan = true;
        return reply.send({ ok: true });
      },
    );

    const res = await app.inject({ method: "GET", url: "/protected" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
    expect(handlerRan).toBe(true);

    await app.close();
  });
});

describe("skipUnmodifiedSessionSave", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  async function createApp() {
    const app = Fastify();
    await app.register(fastifyCookie);
    app.addHook("onSend", skipUnmodifiedSessionSave);
    await app.register(fastifySession, {
      secret: "01234567890123456789012345678901",
      cookieName: "sessionId",
      cookie: {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 60 * 60 * 1000,
      },
      rolling: true,
    });
    app.post("/login", async (request, reply) => {
      request.session.userId = "u-1";
      return reply.send({ ok: true });
    });

    app.get("/pingauth", async (_request, reply) => {
      return reply.send({ ok: true });
    });

    app.get("/api/stream/movies/1", async (_request, reply) => {
      return reply.send("video");
    });

    return app;
  }

  it("does not rewrite the session cookie on stream GETs", async () => {
    const app = await createApp();

    const login = await app.inject({ method: "POST", url: "/login" });
    const cookie = firstCookie(login);
    expect(cookie.startsWith("sessionId=")).toBe(true);

    const stream = await app.inject({
      method: "GET",
      url: "/api/stream/movies/1",
      headers: { cookie },
    });

    expect(stream.statusCode).toBe(200);
    expect(stream.body).toBe("video");
    expect(stream.headers["set-cookie"]).toBeUndefined();

    await app.close();
  });

  it("still rolls the session cookie on non-stream GETs", async () => {
    const app = await createApp();

    const login = await app.inject({ method: "POST", url: "/login" });
    const cookie = firstCookie(login);

    const ping = await app.inject({
      method: "GET",
      url: "/pingauth",
      headers: { cookie },
    });

    expect(ping.statusCode).toBe(200);
    expect(ping.headers["set-cookie"]).toBeDefined();

    await app.close();
  });

  it("rewrites the session cookie on stream GETs when expiry is within the renew window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const app = await createApp();

    const login = await app.inject({ method: "POST", url: "/login" });
    const cookie = firstCookie(login);

    vi.advanceTimersByTime(60 * 60 * 1000 - STREAM_SESSION_RENEW_WINDOW_MS);

    const stream = await app.inject({
      method: "GET",
      url: "/api/stream/movies/1",
      headers: { cookie },
    });

    expect(stream.statusCode).toBe(200);
    expect(stream.body).toBe("video");
    expect(stream.headers["set-cookie"]).toBeDefined();

    await app.close();
  });
});

describe("sessionCookieNeedsRenewal", () => {
  const now = Date.parse("2026-09-10T12:00:00.000Z");

  it("is false when more than the window remains", () => {
    expect(
      sessionCookieNeedsRenewal(
        { originalExpires: new Date(now + STREAM_SESSION_RENEW_WINDOW_MS + 1) },
        now,
      ),
    ).toBe(false);
  });

  it("is true when remaining time is within the window", () => {
    expect(
      sessionCookieNeedsRenewal(
        { originalExpires: new Date(now + STREAM_SESSION_RENEW_WINDOW_MS) },
        now,
      ),
    ).toBe(true);
  });

  it("is false when the cookie has no expiry", () => {
    expect(sessionCookieNeedsRenewal({}, now)).toBe(false);
  });
});
