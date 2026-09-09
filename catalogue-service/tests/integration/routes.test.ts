import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loginUserMock = vi.fn();
const resolveSessionMock = vi.fn();
const browseMoviesMock = vi.fn();

vi.mock("../../src/modules/auth/authService.js", () => ({
  loginUser: loginUserMock,
  resolveSession: resolveSessionMock,
}));

vi.mock("../../src/modules/browse/browseService.js", () => ({
  browseMovies: browseMoviesMock,
}));

async function createApp() {
  const app = Fastify();

  await app.register(fastifyCookie);
  await app.register(fastifySession, {
    secret: "01234567890123456789012345678901",
    cookieName: "sessionId",
    cookie: {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    },
  });

  const { healthRoutes } = await import("../../src/api/health/healthRoutes.js");
  const { authRoutes } = await import("../../src/api/auth/authRoutes.js");
  const { browseRoutes } = await import("../../src/api/browse/browseRoutes.js");

  await app.register(healthRoutes);
  await app.register(authRoutes);

  // Test-only helper for creating authenticated sessions for protected endpoints.
  app.post("/test/session", async (request, reply) => {
    const body = (request.body ?? {}) as {
      userId?: string;
      email?: string;
      userName?: string;
    };
    request.session.userId = body.userId;
    request.session.email = body.email;
    request.session.userName = body.userName;
    return reply.send({ ok: true });
  });

  await app.register(browseRoutes);
  return app;
}

function getCookie(response: { headers: Record<string, unknown> }): string {
  const raw = response.headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  return String(first ?? "").split(";")[0] ?? "";
}

describe("route behavior", () => {
  beforeEach(() => {
    loginUserMock.mockReset();
    resolveSessionMock.mockReset();
    browseMoviesMock.mockReset();
  });

  it("returns ping response", async () => {
    const app = await createApp();
    const res = await app.inject({ method: "GET", url: "/ping" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe("Ping OK!");

    await app.close();
  });

  it("rejects protected auth endpoint without session", async () => {
    const app = await createApp();
    const res = await app.inject({ method: "GET", url: "/getcurrentuser" });

    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "Unauthorized" });

    await app.close();
  });

  it("supports login then returns current user and pingauth", async () => {
    const app = await createApp();

    loginUserMock.mockResolvedValueOnce({
      id: "u-100",
      email: "user@example.com",
      userName: "user1",
    });

    resolveSessionMock.mockReturnValueOnce({
      id: "u-100",
      email: "user@example.com",
      userName: "user1",
    });

    const loginRes = await app.inject({
      method: "POST",
      url: "/userlogin",
      payload: { email: "user@example.com", password: "secret" },
    });

    expect(loginRes.statusCode).toBe(200);
    expect(loginRes.json()).toEqual({ email: "user@example.com" });

    const cookie = getCookie(
      loginRes as unknown as { headers: Record<string, unknown> },
    );

    const meRes = await app.inject({
      method: "GET",
      url: "/getcurrentuser",
      headers: { cookie },
    });

    expect(meRes.statusCode).toBe(200);
    expect(meRes.json()).toEqual({ email: "user@example.com" });

    const pingAuthRes = await app.inject({
      method: "GET",
      url: "/pingauth",
      headers: { cookie },
    });

    expect(pingAuthRes.statusCode).toBe(200);
    expect(pingAuthRes.json()).toEqual({ email: "user@example.com" });

    await app.close();
  });

  it("destroys the session before logout succeeds", async () => {
    const app = await createApp();

    loginUserMock.mockResolvedValueOnce({
      id: "u-200",
      email: "user@example.com",
      userName: "user1",
    });

    const loginRes = await app.inject({
      method: "POST",
      url: "/userlogin",
      payload: { email: "user@example.com", password: "secret" },
    });

    const cookie = getCookie(
      loginRes as unknown as { headers: Record<string, unknown> },
    );

    const logoutRes = await app.inject({
      method: "POST",
      url: "/logout",
      headers: { cookie },
    });

    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json()).toEqual({});

    const meRes = await app.inject({
      method: "GET",
      url: "/getcurrentuser",
      headers: { cookie },
    });

    expect(meRes.statusCode).toBe(401);
    expect(meRes.json()).toEqual({ error: "Unauthorized" });

    await app.close();
  });

  it("returns 404 on browse when service returns no movies", async () => {
    const app = await createApp();

    const sessionRes = await app.inject({
      method: "POST",
      url: "/test/session",
      payload: { userId: "u-1", userName: "alice", email: "alice@example.com" },
    });
    const cookie = getCookie(
      sessionRes as unknown as { headers: Record<string, unknown> },
    );

    browseMoviesMock.mockResolvedValueOnce({
      page: 1,
      results: [],
      totalPages: 0,
      totalResults: 0,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/browse/browsemovies?page=1",
      headers: { cookie },
    });

    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({
      error: "No movies found in the configured directory.",
    });

    await app.close();
  });

  it("returns browse payload with authenticated session", async () => {
    const app = await createApp();

    const sessionRes = await app.inject({
      method: "POST",
      url: "/test/session",
      payload: { userId: "u-2", userName: "bob", email: "bob@example.com" },
    });
    const cookie = getCookie(
      sessionRes as unknown as { headers: Record<string, unknown> },
    );

    browseMoviesMock.mockResolvedValueOnce({
      page: 1,
      results: [
        {
          id: 1,
          title: "Movie",
          extras: [],
          url: "stream/movies/1/master.m3u8",
        },
      ],
      totalPages: 1,
      totalResults: 1,
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/browse/browsemovies?page=2",
      headers: { cookie },
    });

    expect(browseMoviesMock).toHaveBeenCalledWith("bob", 2);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      page: 1,
      results: [
        {
          id: 1,
          title: "Movie",
          extras: [],
          url: "stream/movies/1/master.m3u8",
        },
      ],
      totalPages: 1,
      totalResults: 1,
    });

    await app.close();
  });
});
