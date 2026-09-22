import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/app/config.js", () => ({
  config: {
    sharedMoviesPath: "D:/media/movies",
    sharedTvPath: "D:/media/tv",
  },
}));

describe("mediaPathService", () => {
  it("returns the deployment-level paths shared by every user", async () => {
    const { getMediaPaths } =
      await import("../../src/modules/media-paths/mediaPathService.js");

    expect(getMediaPaths()).toEqual({
      moviesPath: "D:/media/movies",
      tvPath: "D:/media/tv",
    });
  });
});
