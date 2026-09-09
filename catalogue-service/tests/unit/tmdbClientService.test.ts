import { describe, expect, it } from "vitest";
import {
  buildTmdbMovieSearchUrl,
  mapTmdbCastMember,
  mapTmdbCrewMember,
} from "../../src/modules/tmdb/tmdbClientService.js";

describe("buildTmdbMovieSearchUrl", () => {
  it("puts the year in a dedicated filter instead of the query text", () => {
    const url = buildTmdbMovieSearchUrl("Big Fish", 2003);

    expect(url.searchParams.get("query")).toBe("Big Fish");
    expect(url.searchParams.get("year")).toBe("2003");
    expect(url.searchParams.get("query")).not.toContain("2003");
  });

  it("omits the year filter when no release year is provided", () => {
    const url = buildTmdbMovieSearchUrl("Jackie Brown");

    expect(url.searchParams.get("query")).toBe("Jackie Brown");
    expect(url.searchParams.get("year")).toBeNull();
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
    const url = buildTmdbMovieSearchUrl("Big Fish", 2003);

    expect(url.searchParams.get("query")).toBe("Big Fish");
    expect(url.searchParams.get("year")).toBe("2003");
    expect(url.searchParams.get("query")).not.toContain("2003");
  });

  it("omits the year filter when no release year is provided", () => {
    const url = buildTmdbMovieSearchUrl("Jackie Brown");

    expect(url.searchParams.get("query")).toBe("Jackie Brown");
    expect(url.searchParams.get("year")).toBeNull();
  });
});
