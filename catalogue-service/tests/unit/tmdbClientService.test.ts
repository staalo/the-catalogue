import { describe, expect, it } from "vitest";
import {
  buildTmdbMovieSearchUrl,
  buildTmdbTvDetailsUrl,
  buildTmdbTvSearchUrl,
  buildTmdbTvSeasonUrl,
  mapTmdbCastMember,
  mapTmdbCreator,
  mapTmdbCrewMember,
} from "../../src/modules/tmdb/tmdbClientService.js";

describe("buildTmdbMovieSearchUrl", () => {
  it("puts the year in a dedicated filter instead of the query text", () => {
    const url = buildTmdbMovieSearchUrl("Movie", 2000);

    expect(url.searchParams.get("query")).toBe("Movie");
    expect(url.searchParams.get("year")).toBe("2000");
    expect(url.searchParams.get("query")).not.toContain("2003");
  });

  it("omits the year filter when no release year is provided", () => {
    const url = buildTmdbMovieSearchUrl("Movie 2");

    expect(url.searchParams.get("query")).toBe("Movie 2");
    expect(url.searchParams.get("year")).toBeNull();
  });
});

describe("buildTmdbTvSearchUrl", () => {
  it("filters TV search by first air year", () => {
    const url = buildTmdbTvSearchUrl("TV Series", 2000);

    expect(url.pathname).toBe("/3/search/tv");
    expect(url.searchParams.get("query")).toBe("TV Series");
    expect(url.searchParams.get("first_air_date_year")).toBe("2000");
    expect(url.searchParams.get("year")).toBeNull();
    expect(url.searchParams.get("include_adult")).toBeNull();
  });
});

describe("buildTmdbTvDetailsUrl", () => {
  it("requests the series by id with no extra resources", () => {
    const url = buildTmdbTvDetailsUrl(1920);

    expect(url.pathname).toBe("/3/tv/1920");
    expect(url.searchParams.get("append_to_response")).toBeNull();
  });
});

describe("buildTmdbTvSeasonUrl", () => {
  it("puts the season number in the path", () => {
    const url = buildTmdbTvSeasonUrl(1920, 1);

    expect(url.pathname).toBe("/3/tv/1920/season/1");
    expect(url.searchParams.get("append_to_response")).toBeNull();
  });
});

describe("mapTmdbCreator", () => {
  it("stores a series creator as crew with the job Creator", () => {
    expect(
      mapTmdbCreator({
        id: 12240,
        credit_id: "52542276760ee3132800068e",
        name: "David Lynch",
        original_name: "David Lynch",
        gender: 2,
        profile_path: "/b8mo2h.jpg",
      }),
    ).toEqual({
      personId: 12240,
      name: "David Lynch",
      job: "Creator",
      department: "Creator",
      profilePath: "/b8mo2h.jpg",
      adult: false,
      creditId: "52542276760ee3132800068e",
      gender: 2,
      knownForDepartment: undefined,
      originalName: "David Lynch",
      popularity: 0,
    });
  });
});

describe("mapTmdbCastMember", () => {
  it("copies TMDB snake_case credit fields onto local camelCase columns", () => {
    expect(
      mapTmdbCastMember({
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
      }),
    ).toEqual({
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
    });
  });
});

describe("mapTmdbCrewMember", () => {
  it("copies TMDB snake_case credit fields onto local camelCase columns", () => {
    expect(
      mapTmdbCrewMember({
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
      }),
    ).toEqual({
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
    });
  });
});


describe("buildTmdbMovieSearchUrl", () => {
  it("puts the year in a dedicated filter instead of the query text", () => {
    const url = buildTmdbMovieSearchUrl("Movie", 2000);

    expect(url.searchParams.get("query")).toBe("Movie");
    expect(url.searchParams.get("year")).toBe("2000");
    expect(url.searchParams.get("query")).not.toContain("2003");
  });

  it("omits the year filter when no release year is provided", () => {
    const url = buildTmdbMovieSearchUrl("Movie 2");

    expect(url.searchParams.get("query")).toBe("Movie 2");
    expect(url.searchParams.get("year")).toBeNull();
  });
});
