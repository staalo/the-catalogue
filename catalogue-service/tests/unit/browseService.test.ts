import { describe, expect, it, vi } from "vitest";

const getMediaPathsMock = vi.fn();
const getMoviesPaginatedMock = vi.fn();

vi.mock("../../src/modules/media-paths/mediaPathService.js", () => ({
  getMediaPaths: getMediaPathsMock,
}));

vi.mock("../../src/infra/db/repositories/localMovieRepository.js", () => ({
  getMoviesPaginated: getMoviesPaginatedMock,
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
    expect(result.results[0]?.extras[0]?.url).toBe(
      "stream/movies/5/extras/7/master.m3u8",
    );
    expect(result.results[0]?.cast[0]?.name).toBe("Actor One");
  });

  it("returns an empty total for tv series until they are catalogued", async () => {
    const { browseTv } = await import("../../src/modules/browse/browseService.js");
    const result = await browseTv(3);

    expect(result).toEqual({
      page: 3,
      results: [],
      totalPages: 0,
      totalResults: 0,
    });
  });
});
