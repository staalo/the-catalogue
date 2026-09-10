import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import {
  resolveByteRange,
  sendRangedFile,
} from "../../src/modules/stream/rangeStream.js";

describe("resolveByteRange", () => {
  it("returns the full file when Range is missing", () => {
    expect(resolveByteRange(undefined, 1000)).toEqual({ status: "full" });
  });

  it("returns the full file for an empty file even with a Range header", () => {
    expect(resolveByteRange("bytes=0-", 0)).toEqual({ status: "full" });
  });

  it("parses an open-ended range", () => {
    expect(resolveByteRange("bytes=100-", 1000)).toEqual({
      status: "partial",
      start: 100,
      end: 999,
    });
  });

  it("parses a closed range and clamps the end to the file size", () => {
    expect(resolveByteRange("bytes=0-499", 1000)).toEqual({
      status: "partial",
      start: 0,
      end: 499,
    });
    expect(resolveByteRange("bytes=0-9999", 1000)).toEqual({
      status: "partial",
      start: 0,
      end: 999,
    });
  });

  it("parses a suffix range", () => {
    expect(resolveByteRange("bytes=-200", 1000)).toEqual({
      status: "partial",
      start: 800,
      end: 999,
    });
  });

  it("treats a suffix larger than the file as the whole file", () => {
    expect(resolveByteRange("bytes=-5000", 1000)).toEqual({
      status: "partial",
      start: 0,
      end: 999,
    });
  });

  it("returns unsatisfiable when the start is past the end of the file", () => {
    expect(resolveByteRange("bytes=1000-", 1000)).toEqual({
      status: "unsatisfiable",
    });
  });

  it("returns unsatisfiable when last-byte is before first-byte", () => {
    expect(resolveByteRange("bytes=200-100", 1000)).toEqual({
      status: "unsatisfiable",
    });
  });

  it("ignores multiple ranges and serves the full file", () => {
    expect(resolveByteRange("bytes=0-10,20-30", 1000)).toEqual({
      status: "full",
    });
  });

  it("ignores a malformed or non-bytes unit", () => {
    expect(resolveByteRange("items=0-10", 1000)).toEqual({ status: "full" });
    expect(resolveByteRange("bytes", 1000)).toEqual({ status: "full" });
  });
});

describe("sendRangedFile", () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  async function fileWithContents(contents: Buffer): Promise<string> {
    dir = await mkdtemp(path.join(tmpdir(), "range-stream-"));
    const filePath = path.join(dir, "clip.bin");
    await writeFile(filePath, contents);
    return filePath;
  }

  it("sends the full body with Accept-Ranges and Content-Length", async () => {
    const filePath = await fileWithContents(Buffer.from("abcdefghij"));
    const app = Fastify();
    app.get("/media", async (_request, reply) =>
      sendRangedFile(reply, filePath, "video/mp4", undefined),
    );

    const res = await app.inject({ method: "GET", url: "/media" });

    expect(res.statusCode).toBe(200);
    expect(res.headers["accept-ranges"]).toBe("bytes");
    expect(res.headers["content-length"]).toBe("10");
    expect(res.headers["content-type"]).toMatch(/video\/mp4/);
    expect(res.rawPayload.toString()).toBe("abcdefghij");

    await app.close();
  });

  it("sends 206 with the requested slice", async () => {
    const filePath = await fileWithContents(Buffer.from("abcdefghij"));
    const app = Fastify();
    app.get("/media", async (request, reply) =>
      sendRangedFile(reply, filePath, "video/mp4", request.headers.range),
    );

    const res = await app.inject({
      method: "GET",
      url: "/media",
      headers: { range: "bytes=2-5" },
    });

    expect(res.statusCode).toBe(206);
    expect(res.headers["accept-ranges"]).toBe("bytes");
    expect(res.headers["content-range"]).toBe("bytes 2-5/10");
    expect(res.headers["content-length"]).toBe("4");
    expect(res.rawPayload.toString()).toBe("cdef");

    await app.close();
  });

  it("sends 416 with bytes */size when the range cannot be satisfied", async () => {
    const filePath = await fileWithContents(Buffer.from("abcdefghij"));
    const app = Fastify();
    app.get("/media", async (request, reply) =>
      sendRangedFile(reply, filePath, "video/mp4", request.headers.range),
    );

    const res = await app.inject({
      method: "GET",
      url: "/media",
      headers: { range: "bytes=50-" },
    });

    expect(res.statusCode).toBe(416);
    expect(res.headers["accept-ranges"]).toBe("bytes");
    expect(res.headers["content-range"]).toBe("bytes */10");

    await app.close();
  });
});
