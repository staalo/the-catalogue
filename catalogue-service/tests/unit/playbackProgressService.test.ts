import { beforeEach, describe, expect, it, vi } from "vitest";

const getMovieByIdMock = vi.fn();
const listProgressMock = vi.fn();
const upsertProgressMock = vi.fn();

vi.mock("../../src/infra/db/repositories/localMovieRepository.js", () => ({
  getMovieById: getMovieByIdMock,
}));

vi.mock(
  "../../src/infra/db/repositories/playbackProgressRepository.js",
  () => ({
    listMoviePlaybackProgress: listProgressMock,
    upsertMoviePlaybackProgress: upsertProgressMock,
  }),
);

describe("playbackProgressService", () => {
  beforeEach(() => {
    getMovieByIdMock.mockReset();
    listProgressMock.mockReset();
    upsertProgressMock.mockReset();
  });

  it("lists progress for only the requested user", async () => {
    const items = [{ movieId: 2, progress: 42, updatedAt: "2026-09-14" }];
    listProgressMock.mockReturnValueOnce(items);

    const { getMoviePlaybackProgress } =
      await import("../../src/modules/playback/playbackProgressService.js");

    expect(getMoviePlaybackProgress("user-1")).toEqual({ items });
    expect(listProgressMock).toHaveBeenCalledWith("user-1");
  });

  it("rejects invalid movie IDs and progress values", async () => {
    const { saveMoviePlaybackProgress } =
      await import("../../src/modules/playback/playbackProgressService.js");

    await expect(
      saveMoviePlaybackProgress("user-1", 0, 20),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      saveMoviePlaybackProgress("user-1", 1, Number.NaN),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("returns 404 when the movie does not exist", async () => {
    getMovieByIdMock.mockResolvedValueOnce(undefined);
    const { saveMoviePlaybackProgress } =
      await import("../../src/modules/playback/playbackProgressService.js");

    await expect(
      saveMoviePlaybackProgress("user-1", 99, 20),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("clamps and retains completed progress", async () => {
    getMovieByIdMock.mockResolvedValue({});
    upsertProgressMock
      .mockReturnValueOnce({
        movieId: 4,
        progress: 100,
        updatedAt: "2026-09-14",
      })
      .mockReturnValueOnce({
        movieId: 4,
        progress: 97,
        updatedAt: "2026-09-14",
      });

    const { saveMoviePlaybackProgress } =
      await import("../../src/modules/playback/playbackProgressService.js");

    await saveMoviePlaybackProgress("user-1", 4, 120);
    await saveMoviePlaybackProgress("user-1", 4, 97);

    expect(upsertProgressMock).toHaveBeenNthCalledWith(1, "user-1", 4, 100);
    expect(upsertProgressMock).toHaveBeenNthCalledWith(2, "user-1", 4, 97);
  });
});
