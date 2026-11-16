import { expect, test } from "vitest";
import {
  formatExtraRuntime,
  formatExtraSpan,
  formatRuntimeSpan,
  formatWatchedSpan,
  mapMovieToMedia,
} from "@/lib/media";
import type { MovieResponse } from "@/types";

test("formats elapsed time against the movie runtime", () => {
  expect(formatWatchedSpan(40, 155)).toBe("1h 2m / 2h 35m");
  expect(formatWatchedSpan(0, 155)).toBe("0m / 2h 35m");
  expect(formatWatchedSpan(100, 155)).toBe("2h 35m / 2h 35m");
  expect(formatWatchedSpan(50, 45)).toBe("23m / 45m");
  expect(formatWatchedSpan(40, 0)).toBe("");
});

test("formats elapsed time against an episode runtime", () => {
  expect(formatRuntimeSpan(40, "1:30:09")).toBe("36m / 1h 30m");
  expect(formatRuntimeSpan(0, "1:26:57")).toBe("1h 27m");
  expect(formatRuntimeSpan(100, "44:31")).toBe("45m / 45m");
  expect(formatRuntimeSpan(50, "0:30")).toBe("0m / 1m");
  expect(formatRuntimeSpan(40, "")).toBe("");
});

test("formats an extra runtime like a movie", () => {
  expect(formatExtraRuntime("8:46")).toBe("8m 46s");
  expect(formatExtraRuntime("2:32")).toBe("2m 32s");
  expect(formatExtraRuntime("0:56")).toBe("56s");
  expect(formatExtraRuntime("0:32")).toBe("32s");
  expect(formatExtraRuntime("1:30:09")).toBe("1h 30m 9s");
  expect(formatExtraRuntime("2:00")).toBe("2m");
  expect(formatExtraRuntime("2m")).toBe("2m");
  expect(formatExtraRuntime("2h 35m")).toBe("2h 35m");
});

test("formats a partly watched movie extra", () => {
  expect(formatExtraSpan(50, "8:46")).toBe("4m 23s / 8m 46s");
  expect(formatExtraSpan(40, "2m")).toBe("1m / 2m");
});

test("keeps the movie runtime in minutes for the detail view", () => {
  const movie: MovieResponse = {
    id: 1,
    adult: false,
    homepage: null,
    imdbId: null,
    originalLanguage: "en",
    originalTitle: "Dune",
    overview: "A noble family becomes embroiled in a war.",
    popularity: 1,
    posterPath: null,
    backdropPath: null,
    releaseDate: "2021-10-22",
    runtime: 155,
    tagline: null,
    title: "Dune",
    voteAverage: 8,
    voteCount: 1,
    url: "stream/movies/1/master.m3u8",
    hasExtras: false,
    cast: [],
    crew: [],
    genres: [],
    extras: [],
  };

  expect(mapMovieToMedia(movie)).toMatchObject({
    meta: "2h 35m",
    runtimeMinutes: 155,
    subtitles: [],
  });
});

test("maps sidecar subtitles for the movie and its extras", () => {
  const movie: MovieResponse = {
    id: 12,
    adult: false,
    homepage: null,
    imdbId: null,
    originalLanguage: "en",
    originalTitle: "Clip",
    overview: "",
    popularity: 0,
    posterPath: null,
    backdropPath: null,
    releaseDate: null,
    runtime: 0,
    tagline: null,
    title: "Clip",
    voteAverage: 0,
    voteCount: 0,
    url: "stream/movies/12/clip.mp4",
    subtitles: [
      { language: "en", label: "English", url: "stream/movies/12/clip-en.vtt" },
      { language: "fi", label: "Finnish", url: "stream/movies/12/clip-fi.vtt" },
    ],
    hasExtras: true,
    cast: [],
    crew: [],
    genres: [],
    extras: [
      {
        id: 3,
        title: "Bonus",
        runtime: "1:00",
        url: "stream/movies/12/extras/3/bonus.webm",
        subtitles: [
          { language: "fi", label: "Finnish", url: "stream/movies/12/extras/3/bonus-fi.vtt" },
        ],
      },
    ],
  };

  expect(mapMovieToMedia(movie)).toMatchObject({
    subtitles: [
      { language: "en", label: "English", url: "/api/stream/movies/12/clip-en.vtt" },
      { language: "fi", label: "Finnish", url: "/api/stream/movies/12/clip-fi.vtt" },
    ],
    extras: [
      {
        subtitles: [
          { language: "fi", label: "Finnish", url: "/api/stream/movies/12/extras/3/bonus-fi.vtt" },
        ],
      },
    ],
  });
});
