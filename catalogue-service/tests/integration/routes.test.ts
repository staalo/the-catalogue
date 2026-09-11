import Fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifySession from "@fastify/session";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loginUserMock = vi.fn();
const resolveSessionMock = vi.fn();
const registerUserMock = vi.fn();
const browseMoviesMock = vi.fn();

vi.mock("../../src/modules/auth/authService.js", () => ({
  loginUser: loginUserMock,
  resolveSession: resolveSessionMock,
  registerUser: registerUserMock,
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

function cookieTtlMs(response: { headers: Record<string, unknown> }): number | null {
  const raw = response.headers["set-cookie"];
  const first = String(Array.isArray(raw) ? raw[0] : (raw ?? ""));
  const maxAge = first.match(/Max-Age=(\d+)/i);
  if (maxAge) {
    return Number(maxAge[1]) * 1000;
  }

  const expires = first.match(/Expires=([^;]+)/i);
  if (!expires?.[1]) {
    return null;
  }

  return new Date(expires[1]).getTime() - Date.now();
}

describe("route behavior", () => {
  beforeEach(() => {
    loginUserMock.mockReset();
    resolveSessionMock.mockReset();
    registerUserMock.mockReset();
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
    expect(meRes.json()).toEqual({
      email: "user@example.com",
      userName: "user1",
    });

    const pingAuthRes = await app.inject({
      method: "GET",
      url: "/pingauth",
      headers: { cookie },
    });

    expect(pingAuthRes.statusCode).toBe(200);
    expect(pingAuthRes.json()).toEqual({ email: "user@example.com" });

    await app.close();
  });

  it("extends the session cookie when rememberMe is true", async () => {
    const app = await createApp();

    loginUserMock.mockResolvedValue({
      id: "u-100",
      email: "user@example.com",
      userName: "user1",
    });

    const remembered = await app.inject({
      method: "POST",
      url: "/userlogin",
      payload: {
        email: "user@example.com",
        password: "secret",
        rememberMe: true,
      },
    });

    expect(remembered.statusCode).toBe(200);
    const rememberedTtl = cookieTtlMs(
      remembered as unknown as { headers: Record<string, unknown> },
    );
    expect(rememberedTtl).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(rememberedTtl).toBeLessThan(30 * 24 * 60 * 60 * 1000 + 5_000);

    const session = await app.inject({
      method: "POST",
      url: "/userlogin",
      payload: { email: "user@example.com", password: "secret" },
    });

    expect(session.statusCode).toBe(200);
    const sessionTtl = cookieTtlMs(
      session as unknown as { headers: Record<string, unknown> },
    );
    expect(sessionTtl).toBeGreaterThan(55 * 60 * 1000);
    expect(sessionTtl).toBeLessThan(60 * 60 * 1000 + 5_000);

    await app.close();
  });

  it("registers a user and authenticates the session", async () => {
    const app = await createApp();

    registerUserMock.mockResolvedValueOnce({
      id: "u-300",
      email: "new@example.com",
      userName: "new@example.com",
      moviesPath: null,
    });

    const registerRes = await app.inject({
      method: "POST",
      url: "/register",
      payload: { email: "new@example.com", password: "!Salasana1" },
    });

    expect(registerRes.statusCode).toBe(201);
    expect(registerRes.json()).toEqual({
      email: "new@example.com",
      userName: "new@example.com",
      moviesPath: null,
    });

    const cookie = getCookie(
      registerRes as unknown as { headers: Record<string, unknown> },
    );

    resolveSessionMock.mockReturnValueOnce({
      id: "u-300",
      email: "new@example.com",
      userName: "new@example.com",
    });

    const meRes = await app.inject({
      method: "GET",
      url: "/getcurrentuser",
      headers: { cookie },
    });

    expect(meRes.statusCode).toBe(200);
    expect(meRes.json()).toEqual({
      email: "new@example.com",
      userName: "new@example.com",
    });

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
