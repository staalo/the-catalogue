import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const handlers: Record<string, (arg: string) => void | Promise<void>> = {};
  return {
    handlers,
    existsSyncMock: vi.fn<(p: string) => boolean>(),
    readdirSyncMock: vi.fn(() => [] as string[]),
    readFileSyncMock: vi.fn(() => "{}"),
    closeMock: vi.fn(async () => {}),
    watchMock: vi.fn(),
    getMediaPathsMock: vi.fn(),
    createScanRecordMock: vi.fn(() => ({ id: 1 })),
    updateScanRecordMock: vi.fn(),
    movieExistsByUrlMock: vi.fn<(url: string) => boolean>(),
    isMissingTmdbMetadataMock: vi.fn<(url: string) => boolean>(),
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
    searchMovieOnTmdbMock: vi.fn<
      typeof import("../../src/modules/tmdb/tmdbClientService.js").searchMovieOnTmdb
    >(async () => null),
    insertMovieCastMock: vi.fn(),
    insertMovieCrewMock: vi.fn(),
  };
});

vi.mock("node:fs", () => ({
  default: {
    existsSync: state.existsSyncMock,
    readdirSync: state.readdirSyncMock,
    readFileSync: state.readFileSyncMock,
  },
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
  updateScanRecord: state.updateScanRecordMock,
  getLatestScanForUser: vi.fn(),
  movieExistsByUrl: state.movieExistsByUrlMock,
  isMissingTmdbMetadata: state.isMissingTmdbMetadataMock,
  insertDiscoveredMovie: state.insertDiscoveredMovieMock,
  refreshDiscoveredMovie: state.refreshDiscoveredMovieMock,
  insertMovieExtras: state.insertMovieExtrasMock,
  insertMovieCast: state.insertMovieCastMock,
  insertMovieCrew: state.insertMovieCrewMock,
  insertMovieGenres: vi.fn(),
  insertMovieTrailer: vi.fn(),
  deleteMoviesByUrls: state.deleteMoviesByUrlsMock,
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
      extractTitleFromFilename: vi.fn((name: string) => name),
      extractYearFromFilename: vi.fn(() => undefined),
    };
  },
);

describe("mediaWatcherService delete cleanup", () => {
  beforeEach(() => {
    Object.keys(state.handlers).forEach((k) => delete state.handlers[k]);
    state.existsSyncMock.mockReset();
    state.readdirSyncMock.mockReset();
    state.readFileSyncMock.mockReset();
    state.closeMock.mockReset();
    state.watchMock.mockClear();
    state.getMediaPathsMock.mockReset();
    state.createScanRecordMock.mockReset();
    state.updateScanRecordMock.mockReset();
    state.movieExistsByUrlMock.mockReset();
    state.isMissingTmdbMetadataMock.mockReset();
    state.insertDiscoveredMovieMock.mockReset();
    state.refreshDiscoveredMovieMock.mockReset();
    state.insertMovieExtrasMock.mockReset();
    state.deleteMoviesByUrlsMock.mockReset();
    state.searchMovieOnTmdbMock.mockReset();
    state.insertMovieCastMock.mockReset();
    state.insertMovieCrewMock.mockReset();

    state.movieExistsByUrlMock.mockReturnValue(false);
    state.isMissingTmdbMetadataMock.mockReturnValue(false);
    state.insertDiscoveredMovieMock.mockReturnValue(1);
    state.refreshDiscoveredMovieMock.mockReturnValue(1);
    state.searchMovieOnTmdbMock.mockResolvedValue(null);
    state.createScanRecordMock.mockReturnValue({ id: 1 });
  });

  it("deletes matching movie URL candidates when metadata json is removed", async () => {
    state.existsSyncMock.mockReturnValue(true);
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "D:/media/movies",
      tvPath: null,
    });
    state.deleteMoviesByUrlsMock.mockReturnValue(1);

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const unlinkHandler = state.handlers["unlink"];
    expect(unlinkHandler).toBeTypeOf("function");

    await unlinkHandler("D:/media/movies/Sub/Foo.json");

    expect(state.deleteMoviesByUrlsMock).toHaveBeenCalledTimes(1);
    const [urls] = state.deleteMoviesByUrlsMock.mock.calls[0] ?? [];

    expect(urls).toContain("D:/media/movies/Sub/Foo.mp4");
    expect(urls).toContain("D:/media/movies/Sub/Foo.m3u8");
    expect(urls).toContain("D:/media/movies/Sub/Foo.ts");
    expect(urls).toHaveLength(9);
  }, 15000);

  it("closes active watchers on stopAllWatchers", async () => {
    state.existsSyncMock.mockReturnValue(true);
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
    state.existsSyncMock.mockReturnValue(true);
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.readFileSyncMock.mockReturnValue(
      JSON.stringify({
        DVD: {
          Title: "Big Fish",
          Year: 2003,
          Runtime: 120,
          File: "Big Fish\\big-fish.mp4",
        },
        Extras: {
          "1": {
            Title: "Edward Bloom at Large",
            Runtime: "8:46",
            File: "Big Fish\\edward-bloom-at-large.mp4",
          },
          "2": {
            Title: "Amos at the Circus",
            Runtime: "4:38",
            File: "Big Fish\\amos-at-the-circus.mp4",
          },
        },
      }),
    );

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    expect(addHandler).toBeTypeOf("function");

    await addHandler("C:/temp/leffat/big-fish.json");

    expect(state.searchMovieOnTmdbMock).toHaveBeenCalledTimes(1);
    expect(state.searchMovieOnTmdbMock).toHaveBeenCalledWith("Big Fish", 2003);

    expect(state.insertDiscoveredMovieMock).toHaveBeenCalledTimes(1);
    const movieCall = state.insertDiscoveredMovieMock.mock.calls[0];
    const moviePayload = movieCall?.[0] as Record<string, unknown> | undefined;
    expect(moviePayload).toBeDefined();
    expect(moviePayload).toMatchObject({
      title: "Big Fish",
      url: "C:/temp/leffat/Big Fish/big-fish.mp4",
      hasExtras: true,
      runtime: 120,
    });

    expect(state.insertMovieExtrasMock).toHaveBeenCalledTimes(1);
    const [movieId, extras] = state.insertMovieExtrasMock.mock.calls[0] ?? [];
    expect(movieId).toBe(1);
    expect(extras).toEqual([
      {
        title: "Edward Bloom at Large",
        runtime: "8:46",
        url: "C:/temp/leffat/Big Fish/edward-bloom-at-large.mp4",
      },
      {
        title: "Amos at the Circus",
        runtime: "4:38",
        url: "C:/temp/leffat/Big Fish/amos-at-the-circus.mp4",
      },
    ]);
  });

  it("imports movie-only JSON and deletes exact imported URL on unlink", async () => {
    state.existsSyncMock.mockReturnValue(true);
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.readFileSyncMock.mockReturnValue(
      JSON.stringify({
        DVD: {
          Title: "Jackie Brown",
          Year: 1997,
          Runtime: 148,
          File: "Jackie Brown\\master.m3u8",
        },
      }),
    );

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    const unlinkHandler = state.handlers["unlink"];
    expect(addHandler).toBeTypeOf("function");
    expect(unlinkHandler).toBeTypeOf("function");

    await addHandler("C:/temp/leffat/jackie-brown.json");
    await unlinkHandler("C:/temp/leffat/jackie-brown.json");

    expect(state.insertDiscoveredMovieMock).toHaveBeenCalledTimes(1);
    expect(state.insertMovieExtrasMock).not.toHaveBeenCalled();

    const movieCall = state.insertDiscoveredMovieMock.mock.calls[0];
    const moviePayload = movieCall?.[0] as Record<string, unknown> | undefined;
    expect(moviePayload).toBeDefined();
    expect(moviePayload).toMatchObject({
      title: "Jackie Brown",
      url: "C:/temp/leffat/Jackie Brown/master.m3u8",
      hasExtras: false,
      runtime: 148,
    });

    const [deletedUrls] = state.deleteMoviesByUrlsMock.mock.calls.at(-1) ?? [];
    expect(deletedUrls).toEqual(["C:/temp/leffat/Jackie Brown/master.m3u8"]);
  });

  it("retries TMDB search when a movie exists but has no enrichment", async () => {
    state.existsSyncMock.mockReturnValue(true);
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.movieExistsByUrlMock.mockReturnValue(true);
    state.isMissingTmdbMetadataMock.mockReturnValue(true);
    state.readFileSyncMock.mockReturnValue(
      JSON.stringify({
        DVD: {
          Title: "Big Fish",
          Year: 2003,
          Runtime: 120,
          File: "Big Fish\\master.m3u8",
        },
        Extras: {
          "1": {
            Title: "Edward Bloom at Large",
            Runtime: "8:46",
            File: "Big Fish\\Edward Bloom at Large\\master.m3u8",
          },
        },
      }),
    );

    const service = await import("../../src/modules/media-watcher/index.js");

    await service.setupFileWatchers();

    const addHandler = state.handlers["add"];
    expect(addHandler).toBeTypeOf("function");

    await addHandler("C:/temp/leffat/big-fish.json");

    expect(state.searchMovieOnTmdbMock).toHaveBeenCalledWith("Big Fish", 2003);
    expect(state.refreshDiscoveredMovieMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Big Fish",
        url: "C:/temp/leffat/Big Fish/master.m3u8",
      }),
    );
    expect(state.insertDiscoveredMovieMock).not.toHaveBeenCalled();
    expect(state.deleteMoviesByUrlsMock).not.toHaveBeenCalled();
  });

  it("maps TMDB snake_case cast fields onto local columns", async () => {
    state.existsSyncMock.mockReturnValue(true);
    state.getMediaPathsMock.mockReturnValue({
      moviesPath: "C:/temp/leffat",
      tvPath: null,
    });
    state.readFileSyncMock.mockReturnValue(
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

  it("falls back to top-level JSON files when recursive scandir fails", async () => {
    state.readdirSyncMock.mockImplementation(((_dir: string, options?: { recursive?: boolean }) => {
      if (options?.recursive) {
        throw Object.assign(new Error("Unknown system error -526"), {
          code: "Unknown system error -526",
        });
      }

      return ["big-fish.json", "Jackie Brown", "snowpiercer.json"];
    }) as typeof state.readdirSyncMock);

    const { collectJsonMetadataFiles } =
      await import("../../src/modules/media-watcher/mediaWatcherService.js");

    expect(collectJsonMetadataFiles("/media/movies")).toEqual([
      "big-fish.json",
      "snowpiercer.json",
    ]);
  });
});
