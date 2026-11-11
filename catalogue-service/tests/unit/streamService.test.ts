import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getMediaPathsMock = vi.fn();
const getMovieByIdMock = vi.fn();
const getPlayableSeriesNodeMock = vi.fn();

vi.mock("../../src/modules/media-paths/mediaPathService.js", () => ({
  getMediaPaths: getMediaPathsMock,
}));

vi.mock("../../src/infra/db/repositories/localMovieRepository.js", () => ({
  getMovieByIdWithExtras: getMovieByIdMock,
}));

vi.mock("../../src/infra/db/repositories/localSeriesRepository.js", () => ({
  getPlayableSeriesNode: getPlayableSeriesNodeMock,
}));

describe("streamService", () => {
  let moviesPath: string;

  beforeEach(async () => {
    getMediaPathsMock.mockReset();
    getMovieByIdMock.mockReset();
    getPlayableSeriesNodeMock.mockReset();
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
    const [status, file] = await tryGetMovieStream(1);

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
    const [status, file] = await tryGetExtraStream(1, 9);

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
    const [status, file] = await tryGetMovieStream(1);

    expect(status).toBe(StreamStatus.NotFound);
    expect(file).toBeNull();
  });

  it("streams a playable TV node inside the TV library", async () => {
    const filePath = path.join(moviesPath, "episode.mp4");
    await writeFile(filePath, "video");
    getMediaPathsMock.mockReturnValue({ moviesPath: null, tvPath: moviesPath });
    getPlayableSeriesNodeMock.mockReturnValue({
      seriesId: 4,
      nodeId: 12,
      url: filePath,
      metadataFile: path.join(moviesPath, "twin-peaks.json"),
    });

    const { tryGetTvNodeStream, StreamStatus } =
      await import("../../src/modules/stream/streamService.js");
    const [status, file] = await tryGetTvNodeStream(4, 12);

    expect(status).toBe(StreamStatus.Ok);
    expect(file?.filePath).toBe(path.resolve(filePath));
  });

  it("refuses a TV node whose file is outside the TV library", async () => {
    const outside = path.join(tmpdir(), "not-in-library.mp4");
    getMediaPathsMock.mockReturnValue({ moviesPath: null, tvPath: moviesPath });
    getPlayableSeriesNodeMock.mockReturnValue({
      seriesId: 4,
      nodeId: 12,
      url: outside,
      metadataFile: path.join(moviesPath, "twin-peaks.json"),
    });

    const { tryGetTvNodeStream, StreamStatus } =
      await import("../../src/modules/stream/streamService.js");
    const [status, file] = await tryGetTvNodeStream(4, 12);

    expect(status).toBe(StreamStatus.Forbidden);
    expect(file).toBeNull();
  });

  it("streams an HLS asset next to a TV node", async () => {
    const directory = path.join(moviesPath, "pilot");
    await mkdir(directory, { recursive: true });
    const playlist = path.join(directory, "master.m3u8");
    const segment = path.join(directory, "segment.m4s");
    await writeFile(playlist, "#EXTM3U");
    await writeFile(segment, "segment");
    getMediaPathsMock.mockReturnValue({ moviesPath: null, tvPath: moviesPath });
    getPlayableSeriesNodeMock.mockReturnValue({
      seriesId: 4,
      nodeId: 12,
      url: playlist,
      metadataFile: path.join(moviesPath, "twin-peaks.json"),
    });

    const { tryGetTvNodeAssetStream, StreamStatus } =
      await import("../../src/modules/stream/streamService.js");
    const [status, file] = await tryGetTvNodeAssetStream(4, 12, "segment.m4s");

    expect(status).toBe(StreamStatus.Ok);
    expect(file?.filePath).toBe(path.resolve(segment));
  });
});
