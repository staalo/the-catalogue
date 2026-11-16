import { describe, expect, it, vi } from "vitest";

const getMediaPathsMock = vi.fn();
const getMoviesPaginatedMock = vi.fn();
const getSeriesPageMock = vi.fn();
const getSeriesDetailRecordMock = vi.fn();

vi.mock("../../src/modules/media-paths/mediaPathService.js", () => ({
  getMediaPaths: getMediaPathsMock,
}));

vi.mock("../../src/infra/db/repositories/localMovieRepository.js", () => ({
  getMoviesPaginated: getMoviesPaginatedMock,
}));

vi.mock("../../src/infra/db/repositories/localSeriesRepository.js", () => ({
  SERIES_PAGE_SIZE: 20,
  getSeriesPage: getSeriesPageMock,
  getSeriesDetailRecord: getSeriesDetailRecordMock,
}));

describe("browseService", () => {
  it("returns empty result when no movies path is configured", async () => {
    getMediaPathsMock.mockReturnValueOnce({ moviesPath: null, tvPath: null });

    const { browseMovies } =
      await import("../../src/modules/browse/browseService.js");
    const result = await browseMovies(2);

    expect(result).toEqual({
      page: 2,
      results: [],
      totalPages: 0,
      totalResults: 0,
    });
  });

  it("maps relations and rewrites movie and extra stream URLs", async () => {
    getMediaPathsMock.mockReturnValueOnce({
      moviesPath: "D:/media/movies",
      tvPath: null,
    });

    getMoviesPaginatedMock.mockResolvedValueOnce({
      totalCount: 21,
      movies: [
        {
          id: 5,
          adult: false,
          homepage: null,
          imdbId: "tt1",
          originalLanguage: "en",
          originalTitle: "Original",
          overview: "Plot",
          popularity: 7.1,
          posterPath: null,
          releaseDate: "2025-01-01",
          runtime: 120,
          tagline: null,
          title: "Sample Movie",
          voteAverage: 8.2,
          voteCount: 99,
          url: "D:/media/movies/Sample Movie (2025).mkv",
          hasExtras: true,
          cast: [
            {
              id: 1,
              adult: false,
              castId: 3,
              character: "Hero",
              creditId: "c1",
              gender: 2,
              knownForDepartment: "Acting",
              name: "Actor One",
              order: 0,
              originalName: "Actor One",
              popularity: 1.2,
              profilePath: null,
              movieId: 5,
            },
          ],
          crew: [
            {
              id: 10,
              adult: false,
              creditId: "cr1",
              department: "Directing",
              gender: 2,
              job: "Director",
              knownForDepartment: "Directing",
              name: "Director One",
              originalName: "Director One",
              popularity: 1.5,
              profilePath: null,
              movieId: 5,
            },
          ],
          genres: [
            {
              id: 100,
              name: "Drama",
              movieId: 5,
            },
          ],
          extras: [
            {
              id: 7,
              title: "Behind The Scenes",
              runtime: "10:00",
              url: "stream/extras/master.m3u8",
              movieId: 5,
            },
          ],
          trailer: null,
        },
      ],
    });

    const { browseMovies } =
      await import("../../src/modules/browse/browseService.js");
    const result = await browseMovies(1);

    expect(getMoviesPaginatedMock).toHaveBeenCalledWith("D:/media/movies", 1);
    expect(result.totalPages).toBe(2);
    expect(result.totalResults).toBe(21);
    expect(result.results[0]?.url).toBe(
      "stream/movies/5/Sample Movie (2025).mkv",
    );
    expect(result.results[0]?.subtitles).toEqual([]);
    expect(result.results[0]?.extras[0]?.url).toBe(
      "stream/movies/5/extras/7/master.m3u8",
    );
    expect(result.results[0]?.extras[0]?.subtitles).toEqual([]);
    expect(result.results[0]?.cast[0]?.name).toBe("Actor One");
  });

  it("returns an empty total when no TV path is configured", async () => {
    getMediaPathsMock.mockReturnValueOnce({ moviesPath: null, tvPath: null });

    const { browseTv } = await import("../../src/modules/browse/browseService.js");
    const result = await browseTv(3);

    expect(result).toEqual({
      page: 3,
      results: [],
      totalPages: 0,
      totalResults: 0,
    });
    expect(getSeriesPageMock).not.toHaveBeenCalled();
  });

  it("maps a series summary and leaves playback to the detail tree", async () => {
    getMediaPathsMock.mockReturnValueOnce({
      moviesPath: null,
      tvPath: "D:/media/tv",
    });
    getSeriesPageMock.mockResolvedValueOnce({
      totalCount: 1,
      series: [
        {
          id: 4,
          adult: false,
          homepage: null,
          imdbId: null,
          originalLanguage: "en",
          originalTitle: "TV Series 2",
          overview: "A short series overview.",
          popularity: 12,
          posterPath: "/poster.jpg",
          backdropPath: "/backdrop.jpg",
          releaseDate: "2000-01-01",
          year: 2000,
          runtime: 45,
          tagline: null,
          title: "TV Series 2",
          voteAverage: 8.4,
          voteCount: 1000,
          hasExtras: true,
          metadataFile: "D:/media/tv/tv-series-with-versions.json",
          tmdbId: 100,
          seasonCount: 2,
          episodeCount: 11,
          cast: [],
          crew: [],
          genres: [{ id: 3, localSeriesId: 4, genreId: 18, name: "Drama" }],
          trailer: null,
        },
      ],
    });

    const { browseTv } = await import("../../src/modules/browse/browseService.js");
    const result = await browseTv(1);

    expect(getSeriesPageMock).toHaveBeenCalledWith("D:/media/tv", 1);
    expect(result.totalResults).toBe(1);
    expect(result.results[0]).toMatchObject({
      id: 4,
      mediaType: "tv",
      title: "TV Series 2",
      year: 2000,
      url: "",
      hasExtras: true,
      seasonCount: 2,
      episodeCount: 11,
      extras: [],
    });
    expect(result.results[0]?.genres[0]?.name).toBe("Drama");
  });

  it("builds the playable tree with stream urls", async () => {
    getMediaPathsMock.mockReturnValueOnce({
      moviesPath: null,
      tvPath: "D:/media/tv",
    });
    getSeriesDetailRecordMock.mockResolvedValueOnce({
      series: {
        id: 4,
        adult: false,
        homepage: null,
        imdbId: null,
        originalLanguage: null,
        originalTitle: null,
        overview: null,
        popularity: 0,
        posterPath: null,
        backdropPath: null,
        releaseDate: null,
        year: 2000,
        runtime: 0,
        tagline: null,
        title: "TV Series 2",
        voteAverage: 0,
        voteCount: 0,
        hasExtras: true,
        metadataFile: "D:/media/tv/tv-series-with-versions.json",
        tmdbId: null,
        seasonCount: 1,
        episodeCount: 1,
        cast: [],
        crew: [],
        genres: [],
      },
      nodes: [
        {
          id: 10,
          parentId: null,
          kind: "season",
          label: "1",
          title: null,
          runtime: null,
          url: null,
          sortOrder: 0,
          seasonNumber: 1,
          episodeNumber: null,
        },
        {
          id: 11,
          parentId: 10,
          kind: "episode",
          label: "1",
          title: "Pilot",
          runtime: null,
          url: null,
          sortOrder: 0,
          seasonNumber: 1,
          episodeNumber: 1,
        },
        {
          id: 12,
          parentId: 11,
          kind: "version",
          label: "Original",
          title: "Original",
          runtime: "45:00",
          url: "D:/media/tv/TV Series 2/Season 1/Episode 1/Original/master.m3u8",
          sortOrder: 0,
          seasonNumber: 1,
          episodeNumber: 1,
        },
      ],
    });

    const { getSeriesDetail } =
      await import("../../src/modules/browse/browseService.js");
    const detail = await getSeriesDetail(4);

    expect(detail?.nodes[0]?.label).toBe("1");
    expect(detail?.nodes[0]?.url).toBeNull();
    expect(detail?.nodes[0]?.children[0]?.title).toBe("Pilot");
    expect(detail?.nodes[0]?.children[0]?.children[0]?.url).toBe(
      "stream/tv/4/nodes/12/master.m3u8",
    );
    expect(detail?.nodes[0]?.children[0]?.children[0]?.subtitles).toEqual([]);
  });
});
