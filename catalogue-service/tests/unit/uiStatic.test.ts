import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  isApiPath,
  registerUiStatic,
  resolvePublicDir,
} from "../../src/app/uiStatic.js";

describe("isApiPath", () => {
  it("treats API and auth endpoints as API paths", () => {
    expect(isApiPath("/api/browse/browsemovies")).toBe(true);
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/ping")).toBe(true);
    expect(isApiPath("/getcurrentuser")).toBe(true);
    expect(isApiPath("/")).toBe(false);
    expect(isApiPath("/favicon.svg")).toBe(false);
  });
});

describe("resolvePublicDir", () => {
  it("returns null when index.html is missing", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "ui-static-empty-"));
    try {
      expect(resolvePublicDir(dir)).toBeNull();
      expect(resolvePublicDir(null)).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("registerUiStatic", () => {
  let publicDir = "";

  afterEach(async () => {
    if (publicDir) {
      await rm(publicDir, { recursive: true, force: true });
      publicDir = "";
    }
  });

  async function appWithUi(): Promise<ReturnType<typeof Fastify>> {
    publicDir = await mkdtemp(path.join(tmpdir(), "ui-static-"));
    await writeFile(
      path.join(publicDir, "index.html"),
      "<!doctype html><title>Catalogue</title>",
    );
    await mkdir(path.join(publicDir, "assets"));
    await writeFile(path.join(publicDir, "assets", "app.js"), "console.log(1);");

    const app = Fastify();
    app.get("/ping", async () => "Ping OK!");
    await registerUiStatic(app, publicDir);
    return app;
  }

  it("serves the UI index and hashed assets", async () => {
    const app = await appWithUi();
    const index = await app.inject({ method: "GET", url: "/" });
    const asset = await app.inject({ method: "GET", url: "/assets/app.js" });

    expect(index.statusCode).toBe(200);
    expect(index.body).toContain("Catalogue");
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toContain("console.log(1)");

    await app.close();
  });

  it("falls back to index.html for unknown GET routes but not API 404s", async () => {
    const app = await appWithUi();
    const spa = await app.inject({ method: "GET", url: "/anything" });
    const api = await app.inject({ method: "GET", url: "/api/missing" });
    const ping = await app.inject({ method: "GET", url: "/ping" });

    expect(spa.statusCode).toBe(200);
    expect(spa.body).toContain("Catalogue");
    expect(api.statusCode).toBe(404);
    expect(api.json()).toEqual({ error: "Not Found" });
    expect(ping.statusCode).toBe(200);
    expect(ping.body).toBe("Ping OK!");

    await app.close();
  });
});
