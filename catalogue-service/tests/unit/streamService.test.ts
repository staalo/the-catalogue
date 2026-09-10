import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMediaPathsMock = vi.fn();
const getMovieByIdMock = vi.fn();

vi.mock("../../src/infra/db/repositories/localMediaRepository.js", () => ({
  getMediaPaths: getMediaPathsMock,
}));

vi.mock("../../src/infra/db/repositories/localMovieRepository.js", () => ({
  getMovieById: getMovieByIdMock,
}));

describe("streamService", () => {
  let moviesPath: string;

  beforeEach(async () => {
    getMediaPathsMock.mockReset();
    getMovieByIdMock.mockReset();
    moviesPath = await mkdtemp(path.join(tmpdir(), "stream-svc-"));
    getMediaPathsMock.mockReturnValue({ moviesPath, tvPath: null });
  });

  afterEach(async () => {
    await rm(moviesPath, { recursive: true, force: true });
  });

  it("resolves a movie stream from extras-only movie data", async () => {
    const filePath = path.join(moviesPath, "film.mp4");
    await writeFile(filePath, "video");

    getMovieByIdMock.mockResolvedValueOnce({
      id: 1,
      url: filePath,
      extras: [],
    });

    const { tryGetMovieStream, StreamStatus } =
      await import("../../src/modules/stream/streamService.js");
    const [status, file] = await tryGetMovieStream("alice", 1);

    expect(status).toBe(StreamStatus.Ok);
    expect(file?.contentType).toBe("video/mp4");
    expect(file?.filePath).toBe(path.resolve(filePath));
    expect(getMovieByIdMock).toHaveBeenCalledWith(1);
  });

  it("resolves an extra stream without requiring cast, crew, or genres", async () => {
    const extraPath = path.join(moviesPath, "extras", "bonus.mp4");
    await mkdir(path.dirname(extraPath), { recursive: true });
    await writeFile(extraPath, "extra");

    getMovieByIdMock.mockResolvedValueOnce({
      id: 1,
      url: path.join(moviesPath, "film.mp4"),
      extras: [{ id: 9, url: extraPath }],
    });

    const { tryGetExtraStream, StreamStatus } =
      await import("../../src/modules/stream/streamService.js");
    const [status, file] = await tryGetExtraStream("alice", 1, 9);

    expect(status).toBe(StreamStatus.Ok);
    expect(file?.filePath).toBe(path.resolve(extraPath));
  });

  it("returns NotFound when the media file is missing", async () => {
    getMovieByIdMock.mockResolvedValueOnce({
      id: 1,
      url: path.join(moviesPath, "missing.mp4"),
      extras: [],
    });

    const { tryGetMovieStream, StreamStatus } =
      await import("../../src/modules/stream/streamService.js");
    const [status, file] = await tryGetMovieStream("alice", 1);

    expect(status).toBe(StreamStatus.NotFound);
    expect(file).toBeNull();
  });
});
