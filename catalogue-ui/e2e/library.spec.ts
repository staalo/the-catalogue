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
  await expect(page.getByRole("heading", { name: "Drama (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /comedy/i })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /adventure/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Dune/ })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Arrival/ })).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Amelie/ })).toHaveCount(1);
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

test("shows TV series and keeps the generic hero", async ({ page }) => {
  await stubSeries(page, [expanse]);
  await enterLibrary(page);
  await page.getByRole("tab", { name: "TV series" }).click();

  await expect(page.getByRole("tab", { name: "TV series" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("heading", { level: 1, name: "the catalogue" })).toBeVisible();
  await expect(page.getByText("FEATURED MOVIE")).toHaveCount(0);
  await expect(page.getByText("FEATURED SERIES")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "All series (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: /The Expanse/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /action/i })).toHaveCount(0);
  await expect(
    page.getByText("TV series are not available from the catalogue service yet."),
  ).toHaveCount(0);
});

test("says TV series are not available yet", async ({ page }) => {
  await stubSeries(page, "missing");
  await enterLibrary(page);
  await page.getByRole("tab", { name: "TV series" }).click();

  await expect(
    page.getByText("TV series are not available from the catalogue service yet."),
  ).toBeVisible();
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
  await expect(page.getByRole("button", { name: /Amelie/ })).toBeVisible();
});

test("search on the TV tab leaves the series list unchanged", async ({ page }) => {
  await stubSeries(page, [expanse]);
  await enterLibrary(page);
  await page.getByRole("tab", { name: "TV series" }).click();
  await expect(page.getByRole("heading", { name: "All series (1)" })).toBeVisible();

  const searchRequest = page.waitForRequest(
    (request) => request.url().includes("/api/search/movies"),
    { timeout: 1_200 },
  );
  await page.getByPlaceholder("Search your library").fill("dune");

  await expect(searchRequest).rejects.toThrow();
  await expect(page.getByRole("heading", { level: 1, name: "the catalogue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All series (1)" })).toBeVisible();
  await expect(page.getByRole("button", { name: /The Expanse/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /all movies/i })).toHaveCount(0);
});
