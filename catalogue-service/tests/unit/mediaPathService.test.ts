import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const getOwnMediaPathsMock = vi.fn();
const upsertMediaPathsMock = vi.fn();

vi.mock("../../src/infra/db/repositories/localMediaRepository.js", () => ({
  getOwnMediaPaths: getOwnMediaPathsMock,
  upsertMediaPaths: upsertMediaPathsMock,
}));

describe("mediaPathService", () => {
  let dir: string | undefined;

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true });
      dir = undefined;
    }
  });

  it("resolves an existing absolute directory", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "media-path-"));
    const { resolveExistingDirectory } =
      await import("../../src/modules/media-paths/mediaPathService.js");

    const resolved = await resolveExistingDirectory(dir);
    expect(resolved).toBe(path.resolve(dir));
  });

  it("rejects a relative path", async () => {
    const { resolveExistingDirectory } =
      await import("../../src/modules/media-paths/mediaPathService.js");

    await expect(resolveExistingDirectory("movies")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("updates moviesPath after resolving the directory", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "media-path-"));
    upsertMediaPathsMock.mockReturnValueOnce({
      moviesPath: path.resolve(dir),
      tvPath: null,
    });

    const { updateMediaPathsForUser } =
      await import("../../src/modules/media-paths/mediaPathService.js");
    const result = await updateMediaPathsForUser("alice", {
      moviesPath: dir,
    });

    expect(result.moviesPath).toBe(path.resolve(dir));
    expect(upsertMediaPathsMock).toHaveBeenCalledWith("alice", {
      moviesPath: path.resolve(dir),
      tvPath: undefined,
    });
  });

  it("returns stored paths for a user", async () => {
    getOwnMediaPathsMock.mockReturnValueOnce({
      moviesPath: "D:/media/movies",
      tvPath: null,
    });

    const { getMediaPathsForUser } =
      await import("../../src/modules/media-paths/mediaPathService.js");
    expect(getMediaPathsForUser("alice")).toEqual({
      moviesPath: "D:/media/movies",
      tvPath: null,
    });
  });
});
