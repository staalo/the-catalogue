import type { Page, Route } from "@playwright/test";
import { account, expect, openLogin, submitLogin, test } from "./account";

type LibraryTitle = {
  id: number;
  title: string;
  genres?: { id: number; name: string }[];
  overview?: string;
};

function movie(title: LibraryTitle) {
  return {
    id: title.id,
    adult: false,
    homepage: null,
    imdbId: null,
    originalLanguage: "en",
    originalTitle: title.title,
    overview: title.overview ?? `${title.title} overview.`,
    popularity: 1,
    posterPath: null,
    backdropPath: null,
    releaseDate: "2021-10-22",
    runtime: 120,
    tagline: null,
    title: title.title,
    voteAverage: 8,
    voteCount: 1,
    url: `https://example.test/${title.id}.m3u8`,
    hasExtras: false,
    cast: [],
    crew: [],
    genres: title.genres ?? [],
    extras: [],
  };
}

const dune = movie({
  id: 1,
  title: "Dune",
  genres: [{ id: 28, name: "Action" }],
  overview: "A mythic and emotionally charged hero's journey.",
});
const arrival = movie({
  id: 2,
  title: "Arrival",
  genres: [{ id: 18, name: "Drama" }],
  overview: "A linguist learns an alien language.",
});
const amelie = movie({
  id: 3,
  title: "Amelie",
  genres: [{ id: 35, name: "Comedy" }],
  overview: "A shy waitress changes lives in Paris.",
});
const expanse = movie({
  id: 10,
  title: "The Expanse",
  overview: "A missing person pulls the solar system toward war.",
});
const tvSeries = movie({
  id: 12,
  title: "TV Series",
  genres: [
    { id: 35, name: "Comedy" },
    { id: 18, name: "Drama" },
    { id: 10765, name: "Sci-Fi & Fantasy" },
  ],
  overview: "A short series overview.",
});
const tvSeries2Card = {
  ...movie({
    id: 11,
    title: "TV Series 2",
    overview: "A short series overview.",
  }),
  year: 2000,
  seasonCount: 2,
  episodeCount: 3,
};

function tvNode(node: Record<string, unknown>) {
  return {
    title: null,
    runtime: null,
    overview: null,
    stillPath: null,
    url: null,
    seasonNumber: null,
    episodeNumber: null,
    children: [],
    ...node,
  };
}

const tvSeries2Detail = {
  ...tvSeries2Card,
  nodes: [
    tvNode({
      id: 1,
      kind: "season",
      label: "1",
      seasonNumber: 1,
      children: [
        tvNode({
          id: 2,
          kind: "episode",
          label: "1",
          title: "Pilot",
          overview: "The story begins.",
          stillPath: "/pilot.jpg",
          seasonNumber: 1,
          episodeNumber: 1,
          children: [
            tvNode({
              id: 3,
              kind: "version",
              label: "Original",
              title: "Original",
              runtime: "45:00",
              overview: "A different cut.",
              url: "stream/tv/11/nodes/3/master.m3u8",
              seasonNumber: 1,
              episodeNumber: 1,
            }),
            tvNode({
              id: 4,
              kind: "version",
              label: "Alternate",
              title: "Alternate",
              runtime: "42:00",
              url: "stream/tv/11/nodes/4/master.m3u8",
              seasonNumber: 1,
              episodeNumber: 1,
            }),
          ],
        }),
      ],
    }),
    tvNode({
      id: 5,
      kind: "season",
      label: "2",
      seasonNumber: 2,
      children: [
        tvNode({
          id: 6,
          kind: "episode",
          label: "1",
          title: "Second Episode",
          overview: "The story continues.",
          runtime: "45:00",
          url: "stream/tv/11/nodes/6/master.m3u8",
          seasonNumber: 2,
          episodeNumber: 1,
        }),
        tvNode({
          id: 7,
          kind: "extras",
          label: "Extras",
          seasonNumber: 2,
          children: [
            tvNode({
              id: 8,
              kind: "media",
              label: "1",
              title: "Deleted Scenes",
              runtime: "5:00",
              url: "stream/tv/11/nodes/8/deleted-scenes.mp4",
              seasonNumber: 2,
            }),
          ],
        }),
      ],
    }),
    tvNode({
      id: 9,
      kind: "extras",
      label: "Extras",
      children: [
        tvNode({
          id: 10,
          kind: "media",
          label: "Featurette",
          title: "Featurette",
          runtime: "15:00",
          url: "stream/tv/11/nodes/10/lynch.mp4",
        }),
        tvNode({
          id: 11,
          kind: "group",
          label: "Behind the Scenes",
          title: "Behind the Scenes",
          children: [
            tvNode({
              id: 12,
              kind: "media",
              label: "Part 1",
              title: "Part 1",
              runtime: "20:00",
              url: "stream/tv/11/nodes/12/season-one.mp4",
            }),
          ],
        }),
      ],
    }),
  ],
};

function fulfill(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

function catalogueBody(results: ReturnType<typeof movie>[]) {
  return {
    page: 1,
    results,
    totalPages: results.length > 0 ? 1 : 0,
    totalResults: results.length,
  };
}

async function stubMovies(
  page: Page,
  results: ReturnType<typeof movie>[] | { error: string },
) {
  await page.route("**/api/browse/browsemovies**", (route) => {
    if ("error" in results) {
      return fulfill(route, 500, { error: results.error });
    }

    return fulfill(route, 200, catalogueBody(results));
  });
}

async function stubSeries(page: Page, results: ReturnType<typeof movie>[] | "missing") {
  await page.route("**/api/browse/browsetv**", (route) => {
    if (results === "missing") {
      return fulfill(route, 404, { error: "Not found" });
    }

    return fulfill(route, 200, catalogueBody(results));
  });
}

async function enterLibrary(page: Page) {
  await openLogin(page);
  await submitLogin(page, account.email, account.password);
  await expect(page.getByRole("button", { name: "open profile" })).toBeVisible();
}

test("shows the featured movie, the full rail, and genre rails", async ({ page }) => {
  await stubMovies(page, [dune, arrival, amelie]);
  await enterLibrary(page);

  await expect(page.getByText("FEATURED MOVIE")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Dune" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All movies (3)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Action (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comedy (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drama (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /adventure/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Dune/ })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Arrival/ })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Amelie/ })).toHaveCount(2);
});

test("shows an empty movie library", async ({ page }) => {
  await stubMovies(page, []);
  await enterLibrary(page);

  await expect(page.getByRole("heading", { level: 1, name: "the catalogue" })).toBeVisible();
  await expect(page.getByText("No movies found in your library.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /all movies/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Play" })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("shows an error when the catalogue cannot be loaded", async ({ page }) => {
  await stubMovies(page, { error: "The library is unavailable." });
  await enterLibrary(page);

  await expect(page.getByRole("alert")).toHaveText("The library is unavailable.");
  await expect(page.getByRole("heading", { name: /all movies/i })).toHaveCount(0);
});

test("features a TV series from the series list", async ({ page }) => {
  await stubSeries(page, [expanse]);
  await enterLibrary(page);
  await page.getByRole("tab", { name: "TV series" }).click();

  await expect(page.getByRole("tab", { name: "TV series" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByText("FEATURED SERIES")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "The Expanse" })).toBeVisible();
  await expect(page.getByText("FEATURED MOVIE")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "All series (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: /The Expanse/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /action/i })).toHaveCount(0);
  await expect(page.getByText("No TV series found in your library.")).toHaveCount(0);
});

test("lists a rail for every genre on a TV series", async ({ page }) => {
  await stubSeries(page, [tvSeries, expanse]);
  await enterLibrary(page);
  await page.getByRole("tab", { name: "TV series" }).click();

  await expect(page.getByRole("heading", { name: "All series (2)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comedy (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drama (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sci-Fi & Fantasy (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /action/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /TV Series/ })).toHaveCount(4);
  await expect(page.getByRole("button", { name: /The Expanse/ })).toHaveCount(1);
});

test("shows an empty TV library", async ({ page }) => {
  await stubSeries(page, "missing");
  await enterLibrary(page);
  await page.getByRole("tab", { name: "TV series" }).click();

  await expect(page.getByText("No TV series found in your library.")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "the catalogue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /all series/i })).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("search narrows movies and clearing it restores the library", async ({ page }) => {
  const queries: string[] = [];
  await stubMovies(page, [dune, arrival, amelie]);
  await page.route("**/api/search/movies**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    queries.push(query);
    const results = [dune, arrival, amelie].filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()),
    );
    return fulfill(route, 200, {
      query,
      totalResults: results.length,
      results,
    });
  });
  await enterLibrary(page);

  await page.getByPlaceholder("Search your library").fill("  Arrival  ");

  await expect(page.getByRole("heading", { level: 1, name: "Arrival" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All movies (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Drama (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Action (1)" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Amelie/ })).toHaveCount(0);
  expect(queries).toEqual(["Arrival"]);

  await page.getByRole("button", { name: "clear search" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "Dune" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All movies (3)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Action (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Comedy (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Amelie/ })).toHaveCount(2);
});

test("search narrows TV series", async ({ page }) => {
  const queries: string[] = [];
  await stubSeries(page, [expanse, tvSeries2Card]);
  await page.route("**/api/search/tv**", (route) => {
    const query = new URL(route.request().url()).searchParams.get("q") ?? "";
    queries.push(query);
    const results = [expanse, tvSeries2Card].filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()),
    );
    return fulfill(route, 200, {
      query,
      totalResults: results.length,
      results,
    });
  });
  await enterLibrary(page);
  await page.getByRole("tab", { name: "TV series" }).click();
  await expect(page.getByRole("heading", { name: "All series (2)" })).toBeVisible();

  const movieSearch = page.waitForRequest(
    (request) => request.url().includes("/api/search/movies"),
    { timeout: 1_200 },
  );
  await page.getByPlaceholder("Search your library").fill("series 2");

  await expect(page.getByText("FEATURED SERIES")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "TV Series 2" })).toBeVisible();
  await expect(page.getByText("FEATURED MOVIE")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "All series (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: /TV Series 2/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /The Expanse/ })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /all movies/i })).toHaveCount(0);
  await expect(movieSearch).rejects.toThrow();
  expect(queries).toEqual(["series 2"]);
});

test("lists episode versions and keeps extras with their season or the series", async ({
  page,
}) => {
  await stubSeries(page, [tvSeries2Card]);
  await page.route("**/api/browse/tv/**", (route) => fulfill(route, 200, tvSeries2Detail));
  await enterLibrary(page);
  await page.getByRole("tab", { name: "TV series" }).click();
  await page.getByRole("button", { name: /TV Series 2/ }).click();

  const dialog = page.getByRole("dialog");
  const original = dialog.getByRole("article", { name: "Episode 1 · Pilot · Original" });
  const alternate = dialog.getByRole("article", { name: "Episode 1 · Pilot · Alternate" });
  await expect(original.getByText("The story begins.")).toBeVisible();
  await expect(alternate.getByText("The story begins.")).toBeVisible();
  await expect(original.getByText("45m", { exact: true })).toBeVisible();
  await expect(alternate.getByText("42m", { exact: true })).toBeVisible();
  await expect(original.getByText("0m / 45m")).toHaveCount(0);
  await expect(alternate.getByText("0m / 42m")).toHaveCount(0);
  await expect(original.getByRole("img", { name: "Episode 1 · Pilot · Original still" })).toBeVisible();
  await expect(alternate.getByRole("img", { name: "Episode 1 · Pilot · Alternate still" })).toBeVisible();
  const start = dialog.getByRole("region", { name: "Start watching" });
  await expect(start.getByRole("button", { name: "Play now" })).toBeVisible();
  await expect(start.getByRole("progressbar")).toHaveCount(0);

  const seasonTwo = dialog.getByRole("region", { name: "Season 2" });
  await expect(seasonTwo.getByRole("heading", { name: "Season 2 - Extras" })).toBeVisible();
  await expect(seasonTwo.getByRole("button", { name: /Deleted Scenes/ })).toBeVisible();
  await expect(seasonTwo.getByRole("button", { name: /Featurette/ })).toHaveCount(0);

  const extras = dialog.getByRole("region", { name: "Extras" });
  await expect(extras.getByRole("button", { name: /Featurette/ })).toBeVisible();
  await expect(extras.getByText("Behind the Scenes")).toBeVisible();
  await expect(extras.getByRole("button", { name: /Deleted Scenes/ })).toHaveCount(0);

  await original.getByRole("button", { name: "Play Episode 1 · Pilot · Original" }).click();

  const player = page.getByRole("dialog");
  await expect(player.getByRole("heading", { name: "Episode 1 · Pilot · Original" })).toBeVisible();
  await expect(player.getByText(/TV Series 2\s+·\s+Season 1\s+·\s+45:00/)).toBeVisible();
});

test("shows watched progress under each episode and plays the next one", async ({ page }) => {
  await stubSeries(page, [tvSeries2Card]);
  await page.route("**/api/browse/tv/**", (route) => fulfill(route, 200, tvSeries2Detail));
  await page.route("**/api/playback/tv**", (route) => {
    if (route.request().method() !== "GET") {
      return fulfill(route, 200, {
        nodeId: 3,
        seriesId: tvSeries2Card.id,
        progress: 50,
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    }

    return fulfill(route, 200, {
      items: [
        {
          nodeId: 3,
          seriesId: tvSeries2Card.id,
          progress: 50,
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
        {
          nodeId: 6,
          seriesId: tvSeries2Card.id,
          progress: 100,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
  });
  await enterLibrary(page);
  await page.getByRole("tab", { name: "TV series" }).click();
  await page.getByRole("button", { name: /TV Series 2/ }).first().click();

  const dialog = page.getByRole("dialog");
  const original = dialog.getByRole("article", { name: "Episode 1 · Pilot · Original" });
  const alternate = dialog.getByRole("article", { name: "Episode 1 · Pilot · Alternate" });
  const finished = dialog.getByRole("article", { name: "Episode 1 · Second Episode" });
  const halfway = original.getByRole("progressbar", { name: "50% watched" });
  const start = dialog.getByRole("region", { name: "Start watching" });

  await expect(start.getByRole("button", { name: "Continue" })).toBeVisible();
  await expect(start.getByRole("progressbar", { name: "50% watched" })).toBeVisible();
  await expect(start.getByText("23m / 45m")).toBeVisible();
  await expect(halfway).toBeVisible();
  await expect(original.getByText("23m / 45m")).toBeVisible();
  await expect(alternate.getByRole("progressbar", { name: "0% watched" })).toBeVisible();
  await expect(alternate.getByText("42m", { exact: true })).toBeVisible();
  await expect(finished.getByRole("progressbar", { name: "100% watched" })).toBeVisible();
  await expect(finished.getByText("45m / 45m")).toBeVisible();
  await expect(halfway.locator(":scope > *")).toHaveCSS("background-color", "rgb(59, 130, 246)");
  expect(
    await original.evaluate((article) => {
      const overview = [...article.querySelectorAll("p")].find(
        (paragraph) => paragraph.textContent === "The story begins.",
      );
      const bar = article.querySelector("[role='progressbar']");
      if (!overview || !bar) {
        return false;
      }
      return Boolean(overview.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING);
    }),
  ).toBe(true);
  expect(
    await halfway.evaluate((track) => {
      const fill = track.firstElementChild;
      if (!(fill instanceof HTMLElement)) {
        return 0;
      }
      const trackWidth = track.getBoundingClientRect().width;
      return trackWidth === 0 ? 0 : fill.getBoundingClientRect().width / trackWidth;
    }),
  ).toBeCloseTo(0.5, 1);

  await original.getByRole("button", { name: "Play Episode 1 · Pilot · Original" }).click();

  const player = page.getByRole("dialog");
  await expect(player.getByRole("heading", { name: "Episode 1 · Pilot · Original" })).toBeVisible();
  await player.locator("video").evaluate((video: HTMLVideoElement) => {
    video.dispatchEvent(new Event("ended"));
  });
  await expect(
    player.getByRole("heading", { name: "Episode 1 · Second Episode" }),
  ).toBeVisible();

  await player.locator("video").evaluate((video: HTMLVideoElement) => {
    video.dispatchEvent(new Event("ended"));
  });
  await expect(
    player.getByRole("heading", { name: "Episode 1 · Second Episode" }),
  ).toBeVisible();
  await expect(player.getByRole("heading", { name: "Episode 1 · Pilot · Alternate" })).toHaveCount(0);
});
