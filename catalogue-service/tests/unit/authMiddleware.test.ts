import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { requireAuth } from "../../src/modules/auth/middleware.js";

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
