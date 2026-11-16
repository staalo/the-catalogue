import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const examplesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../examples",
);

function exampleJson(name: string): string {
  return readFileSync(path.join(examplesDir, name), "utf8");
}

function metadataFilePath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/");
}

/** Mirrors resolveStoragePath so expectations stay valid on POSIX CI runners. */
function storagePath(watcherRoot: string, fileFromJson: string): string {
  const normalizedRelative = fileFromJson.replace(/\\/g, "/");
  return path.resolve(watcherRoot, normalizedRelative).replace(/\\/g, "/");
}

const state = vi.hoisted(() => {
  const handlers: Record<string, (arg: string) => void | Promise<void>> = {};
  return {
    handlers,
    accessMock: vi.fn<(p: string) => Promise<void>>(async () => {}),
    readdirMock: vi.fn(async () => [] as string[]),
    readFileMock: vi.fn(async () => "{}"),
    closeMock: vi.fn(async () => {}),
    watchMock: vi.fn(),
    getMediaPathsMock: vi.fn(),
    createScanRecordMock: vi.fn(() => ({ id: 1 })),
    failInterruptedScansMock: vi.fn(() => 0),
    updateScanRecordMock: vi.fn(),
    movieExistsByUrlMock: vi.fn<(url: string) => boolean>(),
    isMissingTmdbMetadataMock: vi.fn<(url: string) => boolean>(),
    isMissingTmdbMetadataByIdMock: vi.fn<(id: number) => boolean>(),
    insertDiscoveredMovieMock: vi.fn<
      (movie: Record<string, unknown>) => number
    >(() => 1),
    refreshDiscoveredMovieMock: vi.fn<
      (movie: Record<string, unknown>) => number
    >(() => 1),
    insertMovieExtrasMock:
      vi.fn<
        (
          movieId: number,
          extras: Array<{ title: string; runtime: string; url: string }>,
        ) => void
      >(),
    deleteMoviesByUrlsMock: vi.fn<(urls: string[]) => number>(),
    deleteMoviesByMetadataFileMock: vi.fn<(metadataFile: string) => number>(),
    listMoviesWithMetadataFileMock: vi.fn(() => [] as Array<{
      id: number;
      url: string;
      metadataFile: string;
    }>),
    findMovieIdByMetadataFileMock: vi.fn<(metadataFile: string) => number | null>(),
    setMetadataFileIfMissingMock: vi.fn<(url: string, metadataFile: string) => void>(),
    searchMovieOnTmdbMock: vi.fn<
      typeof import("../../src/modules/tmdb/tmdbClientService.js").searchMovieOnTmdb
    >(async () => null),
    insertMovieCastMock: vi.fn(),
    insertMovieCrewMock: vi.fn(),
    findSeriesIdByMetadataFileMock: vi.fn<(metadataFile: string) => number | null>(),
    isSeriesMissingTmdbByIdMock: vi.fn<(seriesId: number) => boolean>(),
    insertDiscoveredSeriesMock: vi.fn<
      (series: Record<string, unknown>, nodes: unknown[]) => number
    >(() => 1),
    refreshDiscoveredSeriesMock: vi.fn<
      (series: Record<string, unknown>, nodes: unknown[]) => number
    >(() => 1),
    deleteSeriesByMetadataFileMock: vi.fn<(metadataFile: string) => number>(),
    listSeriesWithMetadataFileMock: vi.fn(
      () => [] as Array<{ id: number; metadataFile: string }>,
    ),
    insertSeriesCastMock: vi.fn(),
    insertSeriesCrewMock: vi.fn(),
    insertSeriesGenresMock: vi.fn(),
    insertSeriesTrailerMock: vi.fn(),
    searchTvOnTmdbMock: vi.fn<
      typeof import("../../src/modules/tmdb/tmdbClientService.js").searchTvOnTmdb
    >(async () => null),
    fetchTvSeasonDetailsMock: vi.fn(
      async () =>
        [] as Array<{
          episodeNumber: number;
          name: string | null;
          overview: string | null;
          runtimeMinutes: number | null;
          stillPath: string | null;
        }>,
    ),
  };
});

vi.mock("node:fs/promises", () => ({
  access: state.accessMock,
  readdir: state.readdirMock,
  readFile: state.readFileMock,
}));

vi.mock("chokidar", () => {
  state.watchMock.mockImplementation(() => {
    const watcher = {
      on: (event: string, cb: (arg: string) => void | Promise<void>) => {
        state.handlers[event] = cb;
        return watcher;
      },
      close: state.closeMock,
    };
    return watcher;
  });

  return {
    default: {
      watch: state.watchMock,
    },
  };
});

vi.mock("../../src/infra/db/client.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => undefined,
        }),
      }),
    }),
  },
}));

vi.mock("../../src/modules/media-paths/mediaPathService.js", () => ({
  getMediaPaths: state.getMediaPathsMock,
}));

vi.mock("../../src/infra/db/repositories/mediaWatcherRepository.js", () => ({
  createScanRecord: state.createScanRecordMock,
  failInterruptedScans: state.failInterruptedScansMock,
  updateScanRecord: state.updateScanRecordMock,
  getLatestScanForUser: vi.fn(),
  movieExistsByUrl: state.movieExistsByUrlMock,
  isMissingTmdbMetadata: state.isMissingTmdbMetadataMock,
  isMissingTmdbMetadataById: state.isMissingTmdbMetadataByIdMock,
  insertDiscoveredMovie: state.insertDiscoveredMovieMock,
  refreshDiscoveredMovie: state.refreshDiscoveredMovieMock,
  insertMovieExtras: state.insertMovieExtrasMock,
  insertMovieCast: state.insertMovieCastMock,
  insertMovieCrew: state.insertMovieCrewMock,
  insertMovieGenres: vi.fn(),
  insertMovieTrailer: vi.fn(),
  deleteMoviesByUrls: state.deleteMoviesByUrlsMock,
  deleteMoviesByMetadataFile: state.deleteMoviesByMetadataFileMock,
  listMoviesWithMetadataFile: state.listMoviesWithMetadataFileMock,
  findMovieIdByMetadataFile: state.findMovieIdByMetadataFileMock,
  setMetadataFileIfMissing: state.setMetadataFileIfMissingMock,
}));

vi.mock("../../src/infra/db/repositories/localSeriesRepository.js", () => ({
  findSeriesIdByMetadataFile: state.findSeriesIdByMetadataFileMock,
  isSeriesMissingTmdbById: state.isSeriesMissingTmdbByIdMock,
  insertDiscoveredSeries: state.insertDiscoveredSeriesMock,
  refreshDiscoveredSeries: state.refreshDiscoveredSeriesMock,
  deleteSeriesByMetadataFile: state.deleteSeriesByMetadataFileMock,
  listSeriesWithMetadataFile: state.listSeriesWithMetadataFileMock,
  insertSeriesCast: state.insertSeriesCastMock,
  insertSeriesCrew: state.insertSeriesCrewMock,
  insertSeriesGenres: state.insertSeriesGenresMock,
  insertSeriesTrailer: state.insertSeriesTrailerMock,
}));

vi.mock(
  "../../src/modules/tmdb/tmdbClientService.js",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../src/modules/tmdb/tmdbClientService.js")
      >();
    return {
      ...actual,
      searchMovieOnTmdb: state.searchMovieOnTmdbMock,
      searchTvOnTmdb: state.searchTvOnTmdbMock,
      fetchTvSeasonDetails: state.fetchTvSeasonDetailsMock,
      extractTitleFromFilename: vi.fn((name: string) => name),
      extractYearFromFilename: vi.fn(() => undefined),
    };
  },
);

describe("mediaWatcherService delete cleanup", () => {
  beforeEach(() => {
    Object.keys(state.handlers).forEach((k) => delete state.handlers[k]);
    state.accessMock.mockReset();
    state.readdirMock.mockReset();
    state.readFileMock.mockReset();
    state.closeMock.mockReset();
    state.watchMock.mockClear();
    state.getMediaPathsMock.mockReset();
    state.createScanRecordMock.mockReset();
    state.failInterruptedScansMock.mockReset();
    state.updateScanRecordMock.mockReset();
    state.movieExistsByUrlMock.mockReset();
    state.isMissingTmdbMetadataMock.mockReset();
    state.isMissingTmdbMetadataByIdMock.mockReset();
    state.insertDiscoveredMovieMock.mockReset();
    state.refreshDiscoveredMovieMock.mockReset();
    state.insertMovieExtrasMock.mockReset();
    state.deleteMoviesByUrlsMock.mockReset();
    state.deleteMoviesByMetadataFileMock.mockReset();
    state.listMoviesWithMetadataFileMock.mockReset();
    state.findMovieIdByMetadataFileMock.mockReset();
    state.setMetadataFileIfMissingMock.mockReset();
    state.searchMovieOnTmdbMock.mockReset();
    state.insertMovieCastMock.mockReset();
    state.insertMovieCrewMock.mockReset();
    state.findSeriesIdByMetadataFileMock.mockReset();
    state.isSeriesMissingTmdbByIdMock.mockReset();
    state.insertDiscoveredSeriesMock.mockReset();
    state.refreshDiscoveredSeriesMock.mockReset();
    state.deleteSeriesByMetadataFileMock.mockReset();
    state.listSeriesWithMetadataFileMock.mockReset();
    state.insertSeriesCastMock.mockReset();
    state.insertSeriesCrewMock.mockReset();
    state.insertSeriesGenresMock.mockReset();
    state.insertSeriesTrailerMock.mockReset();
    state.searchTvOnTmdbMock.mockReset();
    state.fetchTvSeasonDetailsMock.mockReset();

    state.movieExistsByUrlMock.mockReturnValue(false);
    state.isMissingTmdbMetadataMock.mockReturnValue(false);
    state.isMissingTmdbMetadataByIdMock.mockReturnValue(false);
    state.accessMock.mockResolvedValue(undefined);
    state.readdirMock.mockResolvedValue([]);
    state.readFileMock.mockResolvedValue("{}");
    state.insertDiscoveredMovieMock.mockReturnValue(1);
    state.refreshDiscoveredMovieMock.mockReturnValue(1);
    state.searchMovieOnTmdbMock.mockResolvedValue(null);
    state.createScanRecordMock.mockReturnValue({ id: 1 });
    state.failInterruptedScansMock.mockReturnValue(0);
    state.listMoviesWithMetadataFileMock.mockReturnValue([]);
    state.findMovieIdByMetadataFileMock.mockReturnValue(null);
    state.deleteMoviesByMetadataFileMock.mockReturnValue(1);
    state.findSeriesIdByMetadataFileMock.mockReturnValue(null);
    state.isSeriesMissingTmdbByIdMock.mockReturnValue(false);
    state.insertDiscoveredSeriesMock.mockReturnValue(1);
    state.refreshDiscoveredSeriesMock.mockReturnValue(1);
    state.deleteSeriesByMetadataFileMock.mockReturnValue(1);
    state.listSeriesWithMetadataFileMock.mockReturnValue([]);
    state.searchTvOnTmdbMock.mockResolvedValue(null);
    state.fetchTvSeasonDetailsMock.mockResolvedValue([]);
  });

  it("marks leftover running scans as failed before starting a new one", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "D:/media/movies",
      tvPath: null,
    });

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    await vi.waitFor(() => {
      expect(state.createScanRecordMock).toHaveBeenCalled();
    });

    expect(state.failInterruptedScansMock).toHaveBeenCalledTimes(1);
    const failedAt = state.failInterruptedScansMock.mock.invocationCallOrder[0];
    const createdAt = state.createScanRecordMock.mock.invocationCallOrder[0];
    expect(failedAt).toBeLessThan(createdAt ?? Number.POSITIVE_INFINITY);
  });

  it("ignores nested metadata json on unlink", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "D:/media/movies",
      tvPath: null,
    });

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const unlinkHandler = state.handlers["unlink"];
    expect(unlinkHandler).toBeTypeOf("function");

    await unlinkHandler("D:/media/movies/Sub/Foo.json");

    expect(state.deleteMoviesByMetadataFileMock).not.toHaveBeenCalled();
    expect(state.deleteMoviesByUrlsMock).not.toHaveBeenCalled();
  }, 15000);

  it("deletes the movie row by metadata_file when a top-level json is removed", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "D:/media/movies",
      tvPath: null,
    });

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const unlinkHandler = state.handlers["unlink"];
    expect(unlinkHandler).toBeTypeOf("function");

    await unlinkHandler("D:/media/movies/movie-with-extras.json");

    expect(state.deleteMoviesByMetadataFileMock).toHaveBeenCalledTimes(1);
    expect(state.deleteMoviesByMetadataFileMock).toHaveBeenCalledWith(
      metadataFilePath("D:/media/movies/movie-with-extras.json"),
    );
    expect(state.deleteMoviesByUrlsMock).not.toHaveBeenCalled();
  }, 15000);

  it("closes active watchers on stopAllWatchers", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "D:/media/movies",
      tvPath: null,
    });

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();
    await service.stopAllWatchers();

    expect(state.closeMock).toHaveBeenCalledTimes(1);
  });

  it("imports movie and extras from DVD/Extras JSON format", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.readFileMock.mockResolvedValue(exampleJson("movie-with-extras.json"));

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    expect(addHandler).toBeTypeOf("function");

    await addHandler("C:/temp/leffat/movie-with-extras.json");

    expect(state.searchMovieOnTmdbMock).toHaveBeenCalledTimes(1);
    expect(state.searchMovieOnTmdbMock).toHaveBeenCalledWith("Movie", 2000);

    expect(state.insertDiscoveredMovieMock).toHaveBeenCalledTimes(1);
    expect(state.insertDiscoveredSeriesMock).not.toHaveBeenCalled();
    expect(state.searchTvOnTmdbMock).not.toHaveBeenCalled();
    const movieCall = state.insertDiscoveredMovieMock.mock.calls[0];
    const moviePayload = movieCall?.[0] as Record<string, unknown> | undefined;
    expect(moviePayload).toBeDefined();
    expect(moviePayload).toMatchObject({
      title: "Movie",
      url: storagePath("C:/temp/leffat", "Movie\\master.m3u8"),
      hasExtras: true,
      runtime: 120,
      metadataFile: metadataFilePath("C:/temp/leffat/movie-with-extras.json"),
    });

    expect(state.insertMovieExtrasMock).toHaveBeenCalledTimes(1);
    const [movieId, extras] = state.insertMovieExtrasMock.mock.calls[0] ?? [];
    expect(movieId).toBe(1);
    expect(extras).toEqual([
      {
        title: "Bonus Feature",
        runtime: "8:00",
        url: storagePath("C:/temp/leffat", "Movie\\Bonus Feature\\master.m3u8"),
      },
      {
        title: "Bonus Feature 2",
        runtime: "5:00",
        url: storagePath("C:/temp/leffat", "Movie\\Bonus Feature 2\\master.m3u8"),
      },
    ]);
  });

  it("imports movie-only JSON and deletes exact imported URL on unlink", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.readFileMock.mockResolvedValue(exampleJson("movie.json"));

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    const unlinkHandler = state.handlers["unlink"];
    expect(addHandler).toBeTypeOf("function");
    expect(unlinkHandler).toBeTypeOf("function");

    await addHandler("C:/temp/leffat/movie.json");
    await unlinkHandler("C:/temp/leffat/movie.json");

    expect(state.insertDiscoveredMovieMock).toHaveBeenCalledTimes(1);
    expect(state.insertMovieExtrasMock).not.toHaveBeenCalled();

    const movieCall = state.insertDiscoveredMovieMock.mock.calls[0];
    const moviePayload = movieCall?.[0] as Record<string, unknown> | undefined;
    expect(moviePayload).toBeDefined();
    expect(moviePayload).toMatchObject({
      title: "Movie 2",
      url: storagePath("C:/temp/leffat", "Movie 2\\master.m3u8"),
      hasExtras: false,
      runtime: 90,
      metadataFile: metadataFilePath("C:/temp/leffat/movie.json"),
    });

    expect(state.deleteMoviesByMetadataFileMock).toHaveBeenCalledWith(
      metadataFilePath("C:/temp/leffat/movie.json"),
    );
    expect(state.deleteMoviesByUrlsMock).not.toHaveBeenCalled();
  });

  it("retries TMDB search when a movie exists but has no enrichment", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.movieExistsByUrlMock.mockReturnValue(true);
    state.isMissingTmdbMetadataMock.mockReturnValue(true);
    state.readFileMock.mockResolvedValue(exampleJson("movie-with-extras.json"));

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    expect(addHandler).toBeTypeOf("function");

    await addHandler("C:/temp/leffat/movie-with-extras.json");

    expect(state.searchMovieOnTmdbMock).toHaveBeenCalledWith("Movie", 2000);
    expect(state.refreshDiscoveredMovieMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Movie",
        url: storagePath("C:/temp/leffat", "Movie\\master.m3u8"),
        metadataFile: metadataFilePath("C:/temp/leffat/movie-with-extras.json"),
      }),
    );
    expect(state.insertDiscoveredMovieMock).not.toHaveBeenCalled();
    expect(state.deleteMoviesByUrlsMock).not.toHaveBeenCalled();
  });

  it("maps TMDB snake_case cast fields onto local columns", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.readFileMock.mockResolvedValue(
      JSON.stringify({
        DVD: {
          Title: "Star Wars: Episode IV - A New Hope",
          Year: 1977,
          Runtime: 121,
          File: "Star Wars\\Episode IV - A New Hope\\master.m3u8",
        },
      }),
    );
    state.searchMovieOnTmdbMock.mockResolvedValue({
      id: 11,
      title: "Star Wars",
      credits: {
        cast: [
          {
            adult: false,
            gender: 2,
            id: 2,
            known_for_department: "Acting",
            name: "Mark Hamill",
            original_name: "Mark Hamill",
            popularity: 15.432,
            profile_path: "/zPIug5giU8oug6Xes5K1sTfQJxY.jpg",
            cast_id: 3,
            character: "Luke Skywalker",
            credit_id: "52fe420dc3a36847f8000441",
            order: 0,
          },
        ],
        crew: [
          {
            adult: false,
            gender: 2,
            id: 1,
            known_for_department: "Directing",
            name: "George Lucas",
            original_name: "George Lucas",
            popularity: 12.1,
            profile_path: "/8RsksrQlcN2necpqcqZ6C8sEprB.jpg",
            credit_id: "52fe420dc3a36847f8000453",
            department: "Directing",
            job: "Director",
          },
        ],
      },
    });

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    expect(addHandler).toBeTypeOf("function");

    await addHandler("C:/temp/leffat/star-wars-iv-a-new-hope.json");

    expect(state.insertMovieCastMock).toHaveBeenCalledWith(1, [
      {
        personId: 2,
        name: "Mark Hamill",
        character: "Luke Skywalker",
        profilePath: "/zPIug5giU8oug6Xes5K1sTfQJxY.jpg",
        order: 0,
        adult: false,
        castId: 3,
        creditId: "52fe420dc3a36847f8000441",
        gender: 2,
        knownForDepartment: "Acting",
        originalName: "Mark Hamill",
        popularity: 15.432,
      },
    ]);

    expect(state.insertMovieCrewMock).toHaveBeenCalledWith(1, [
      {
        personId: 1,
        name: "George Lucas",
        job: "Director",
        department: "Directing",
        profilePath: "/8RsksrQlcN2necpqcqZ6C8sEprB.jpg",
        adult: false,
        creditId: "52fe420dc3a36847f8000453",
        gender: 2,
        knownForDepartment: "Directing",
        originalName: "George Lucas",
        popularity: 12.1,
      },
    ]);
  });

  it("collects only top-level JSON metadata files", async () => {
    state.readdirMock.mockResolvedValue([
      "movie-with-extras.json",
      "Movie",
      "movie.json",
      "Sub/nested.json",
    ]);

    const { collectJsonMetadataFiles } =
      await import("../../src/modules/media-watcher/mediaWatcherService.js");

    await expect(collectJsonMetadataFiles("/media/movies")).resolves.toEqual([
      "movie-with-extras.json",
      "movie.json",
    ]);
  });

  it("ignores nested metadata json on add", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    expect(addHandler).toBeTypeOf("function");

    await addHandler("C:/temp/leffat/Movie/nested.json");

    expect(state.insertDiscoveredMovieMock).not.toHaveBeenCalled();
    expect(state.readFileMock).not.toHaveBeenCalled();
  });

  it("skips reading JSON on rescan when metadata_file is already catalogued", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.findMovieIdByMetadataFileMock.mockReturnValue(42);
    state.isMissingTmdbMetadataByIdMock.mockReturnValue(false);

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    expect(addHandler).toBeTypeOf("function");

    await addHandler("C:/temp/leffat/movie-with-extras.json");

    expect(state.readFileMock).not.toHaveBeenCalled();
    expect(state.searchMovieOnTmdbMock).not.toHaveBeenCalled();
    expect(state.insertDiscoveredMovieMock).not.toHaveBeenCalled();
    expect(state.refreshDiscoveredMovieMock).not.toHaveBeenCalled();
  });

  it("removes catalog rows whose top-level metadata file is gone", async () => {
    const missingMetadata = metadataFilePath("C:/temp/leffat/missing.json");
    const otherLibraryMetadata = metadataFilePath(
      "C:/other/library/other.json",
    );

    state.accessMock.mockImplementation(async (filePath: string) => {
      const normalized = String(filePath).replace(/\\/g, "/");
      if (normalized.toLowerCase().endsWith("missing.json")) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
    });
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.readdirMock.mockResolvedValue([]);
    state.listMoviesWithMetadataFileMock.mockReturnValue([
      {
        id: 7,
        url: "C:/temp/leffat/Gone/movie.mp4",
        metadataFile: missingMetadata,
      },
      {
        id: 8,
        url: "C:/other/library/movie.mp4",
        metadataFile: otherLibraryMetadata,
      },
    ]);

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.scanMediaDirectory("system", "movies");

    await vi.waitFor(() => {
      expect(state.deleteMoviesByMetadataFileMock).toHaveBeenCalled();
    });

    expect(state.deleteMoviesByMetadataFileMock).toHaveBeenCalledWith(
      missingMetadata,
    );
    expect(state.deleteMoviesByMetadataFileMock).not.toHaveBeenCalledWith(
      otherLibraryMetadata,
    );
  });

  it("imports a TV series tree and does not create a movie", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: null,
      tvPath: "C:/temp/tv",
    });
    state.searchTvOnTmdbMock.mockResolvedValue({
      id: 100,
      name: "TV Series 2",
      overview: "A short series overview.",
      first_air_date: "2000-01-01",
      episode_run_time: [45],
      created_by: [
        {
          id: 10,
          credit_id: "creator-1",
          name: "Alex Example",
          original_name: "Alex Example",
          gender: 2,
          profile_path: "/creator.jpg",
        },
      ],
      genres: [{ id: 18, name: "Drama" }],
    });
    state.fetchTvSeasonDetailsMock.mockResolvedValue([
      {
        episodeNumber: 1,
        name: "Pilot",
        overview: "The story begins.",
        runtimeMinutes: 45,
        stillPath: "/pilot.jpg",
      },
    ]);
    state.readFileMock.mockResolvedValue(exampleJson("tv-series-with-versions.json"));

    const service = await import("../../src/modules/media-watcher/index.js");
    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    expect(addHandler).toBeTypeOf("function");
    await addHandler("C:/temp/tv/tv-series-with-versions.json");

    expect(state.searchMovieOnTmdbMock).not.toHaveBeenCalled();
    expect(state.insertDiscoveredMovieMock).not.toHaveBeenCalled();
    expect(state.searchTvOnTmdbMock).toHaveBeenCalledWith("TV Series 2", 2000);
    expect(state.fetchTvSeasonDetailsMock).toHaveBeenCalledWith(100, 1);
    expect(state.fetchTvSeasonDetailsMock).toHaveBeenCalledWith(100, 2);
    expect(state.insertSeriesCastMock).not.toHaveBeenCalled();
    expect(state.insertSeriesTrailerMock).not.toHaveBeenCalled();
    expect(state.insertSeriesCrewMock).toHaveBeenCalledWith(1, [
      expect.objectContaining({
        personId: 10,
        name: "Alex Example",
        job: "Creator",
      }),
    ]);
    expect(state.insertSeriesGenresMock).toHaveBeenCalledWith(1, [
      { id: 18, name: "Drama" },
    ]);
    expect(state.insertDiscoveredSeriesMock).toHaveBeenCalledTimes(1);

    const [series, nodes] = state.insertDiscoveredSeriesMock.mock.calls[0] ?? [];
    expect(series).toMatchObject({
      title: "TV Series 2",
      overview: "A short series overview.",
      releaseDate: "2000-01-01",
      year: 2000,
      runtime: 45,
      hasExtras: true,
      tmdbId: 100,
      metadataFile: metadataFilePath("C:/temp/tv/tv-series-with-versions.json"),
    });

    const tree = nodes as Array<{
      kind: string;
      label: string;
      children: Array<{
        title: string | null;
        overview?: string | null;
        stillPath?: string | null;
        runtime: string | null;
        children: Array<{ label: string; filePath: string; runtime: string | null }>;
      }>;
    }>;
    expect(tree[0]?.kind).toBe("season");
    expect(tree[0]?.children[0]?.title).toBe("Pilot");
    expect(tree[0]?.children[0]?.overview).toBe("The story begins.");
    expect(tree[0]?.children[0]?.stillPath).toBe("/pilot.jpg");
    expect(tree[0]?.children[0]?.runtime).toBeNull();
    expect(tree[0]?.children[0]?.children[0]?.runtime).toBe("45:00");
    expect(tree[0]?.children[0]?.children.map((child) => child.label)).toEqual([
      "Original",
      "Alternate",
    ]);
    expect(tree[0]?.children[0]?.children[0]?.filePath).toBe(
      storagePath(
        "C:/temp/tv",
        "TV Series 2\\Season 1\\Episode 1\\Original\\master.m3u8",
      ),
    );
    expect(tree[2]?.kind).toBe("extras");
  });

  it("removes a TV series by metadata file and leaves movies alone", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: "C:/temp/tv",
    });

    const service = await import("../../src/modules/media-watcher/index.js");
    await service.setupFileWatchers();

    const unlinkHandler = state.handlers["unlink"];
    expect(unlinkHandler).toBeTypeOf("function");
    await unlinkHandler("C:/temp/tv/tv-series-with-versions.json");

    expect(state.deleteSeriesByMetadataFileMock).toHaveBeenCalledWith(
      metadataFilePath("C:/temp/tv/tv-series-with-versions.json"),
    );
    expect(state.deleteMoviesByMetadataFileMock).not.toHaveBeenCalled();
  });

  it("skips a TV rescan when the series is already enriched", async () => {
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: null,
      tvPath: "C:/temp/tv",
    });
    state.findSeriesIdByMetadataFileMock.mockReturnValue(9);
    state.isSeriesMissingTmdbByIdMock.mockReturnValue(false);

    const service = await import("../../src/modules/media-watcher/index.js");
    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    expect(addHandler).toBeTypeOf("function");
    await addHandler("C:/temp/tv/tv-series-with-versions.json");

    expect(state.readFileMock).not.toHaveBeenCalled();
    expect(state.searchTvOnTmdbMock).not.toHaveBeenCalled();
    expect(state.insertDiscoveredSeriesMock).not.toHaveBeenCalled();
  });

  it("removes TV rows whose manifest file is gone", async () => {
    const missingMetadata = metadataFilePath("C:/temp/tv/missing.json");
    state.accessMock.mockImplementation(async (filePath: string) => {
      const normalized = String(filePath).replace(/\\/g, "/");
      if (normalized.toLowerCase().endsWith("missing.json")) {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
    });
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: null,
      tvPath: "C:/temp/tv",
    });
    state.listSeriesWithMetadataFileMock.mockReturnValue([
      { id: 3, metadataFile: missingMetadata },
    ]);

    const service = await import("../../src/modules/media-watcher/index.js");
    await service.scanMediaDirectory("system", "tv");

    await vi.waitFor(() => {
      expect(state.deleteSeriesByMetadataFileMock).toHaveBeenCalledWith(
        missingMetadata,
      );
    });
    expect(state.deleteMoviesByMetadataFileMock).not.toHaveBeenCalled();
  });
});
