import type { Page, Route } from "@playwright/test";
import { account, expect, openLogin, submitLogin, test } from "./account";

type ExtraTitle = {
  id: number;
  title: string;
  runtime: string;
  url: string;
};

type LibraryTitle = {
  id: number;
  title: string;
  overview?: string;
  runtime?: number;
  url?: string;
  genres?: { id: number; name: string }[];
  extras?: ExtraTitle[];
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
    runtime: title.runtime ?? 120,
    tagline: null,
    title: title.title,
    voteAverage: 8,
    voteCount: 1,
    url: title.url === undefined ? `https://example.test/${title.id}.m3u8` : title.url,
    hasExtras: Boolean(title.extras?.length),
    cast: [],
    crew: [],
    genres: title.genres ?? [],
    extras: title.extras ?? [],
  };
}

const dune = movie({
  id: 1,
  title: "Dune",
  runtime: 155,
  genres: [{ id: 28, name: "Action" }],
  overview: "A mythic and emotionally charged hero's journey.",
  extras: [
    {
      id: 11,
      title: "Trailer",
      runtime: "2m",
      url: "https://example.test/trailer.m3u8",
    },
  ],
});
const arrival = movie({
  id: 2,
  title: "Arrival",
  genres: [{ id: 18, name: "Drama" }],
  overview: "A linguist learns an alien language.",
});
const silent = movie({
  id: 4,
  title: "Silent",
  url: "",
  overview: "A film with nothing to play.",
});

function fulfill(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function stubMovies(page: Page, results: ReturnType<typeof movie>[]) {
  await page.route("**/api/browse/browsemovies**", (route) =>
    fulfill(route, 200, {
      page: 1,
      results,
      totalPages: 1,
      totalResults: results.length,
    }),
  );
}

async function stubProgress(
  page: Page,
  items: { movieId: number; progress: number }[] | { error: string },
) {
  await page.route("**/api/playback/movies**", (route) => {
    if (route.request().method() !== "GET") {
      return fulfill(route, 200, {
        movieId: 1,
        progress: 0,
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
    }

    if ("error" in items) {
      return fulfill(route, 500, { error: items.error });
    }

    return fulfill(route, 200, {
      items: items.map((item) => ({
        ...item,
        updatedAt: "2026-01-01T00:00:00.000Z",
      })),
    });
  });
}

async function enterLibrary(page: Page) {
  await openLogin(page);
  await submitLogin(page, account.email, account.password);
  await expect(page.getByRole("button", { name: "open profile" })).toBeVisible();
}

async function clickOutsideDialog(page: Page) {
  await page.locator(".MuiDialog-container").click({ position: { x: 8, y: 8 } });
}

function rail(page: Page, name: string) {
  return page.getByRole("heading", { name, exact: true }).locator("xpath=../..");
}

test("opens details from the hero and from a poster", async ({ page }) => {
  await stubMovies(page, [dune, arrival]);
  await enterLibrary(page);

  await page.getByRole("button", { name: "More info" }).click();
  const details = page.getByRole("dialog");
  await expect(details.getByRole("heading", { name: "Dune" })).toBeVisible();
  await expect(details.getByText(dune.overview)).toBeVisible();
  await expect(details.getByText("2021  ·  2h 35m")).toBeVisible();
  await expect(details.getByRole("button", { name: "Play now" })).toBeVisible();

  await clickOutsideDialog(page);
  await expect(details).toBeHidden();

  await page.getByRole("button", { name: /Arrival/ }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Arrival" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText(arrival.overview)).toBeVisible();
});

test("plays from the hero and from details, then closes the player", async ({ page }) => {
  await stubMovies(page, [dune]);
  await enterLibrary(page);

  await page.getByRole("button", { name: "Play" }).click();
  const player = page.getByRole("dialog");
  await expect(player.getByRole("heading", { name: "Dune" })).toBeVisible();
  await expect(player.getByText("2021  ·  2h 35m")).toBeVisible();

  await player.getByRole("button", { name: "close player" }).click();
  await expect(player).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Dune" })).toBeVisible();

  await page.getByRole("button", { name: "More info" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Play now" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Dune" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("2021  ·  2h 35m")).toBeVisible();
  await expect(page.getByRole("button", { name: "Play now" })).toHaveCount(0);

  await page.getByRole("button", { name: "close player" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Dune" })).toBeVisible();
});

test("does not play a title with no video", async ({ page }) => {
  await stubMovies(page, [silent]);
  await enterLibrary(page);

  await page.getByRole("button", { name: "Play" }).click();
  await expect(page.getByRole("button", { name: "close player" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "More info" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Play now" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("button", { name: "close player" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Silent" })).toBeVisible();
});

test("plays an extra", async ({ page }) => {
  await stubMovies(page, [dune]);
  await enterLibrary(page);

  await page.getByRole("button", { name: "More info" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /Trailer/ }).click();

  const player = page.getByRole("dialog");
  await expect(player.getByRole("heading", { name: "Trailer" })).toBeVisible();
  await expect(player.getByText("Dune extra · 2m")).toBeVisible();
  await expect(player.getByRole("heading", { name: "Extras" })).toHaveCount(0);

  await player.getByRole("button", { name: "close player" }).click();
  await expect(player).toBeHidden();
});

test("lists in-progress titles and leaves out finished ones", async ({ page }) => {
  await stubMovies(page, [dune, arrival]);
  await stubProgress(page, [
    { movieId: dune.id, progress: 40 },
    { movieId: arrival.id, progress: 95 },
  ]);
  await enterLibrary(page);

  const continueWatching = rail(page, "Continue watching");
  await expect(continueWatching.getByRole("button", { name: /Dune/ })).toBeVisible();
  await expect(continueWatching.getByRole("button", { name: /Arrival/ })).toHaveCount(0);
  await expect(rail(page, "All movies (2)").getByRole("button", { name: /Arrival/ })).toBeVisible();
});

test("shows a warning when playback progress cannot be synchronized", async ({ page }) => {
  await stubMovies(page, [dune]);
  await stubProgress(page, { error: "Progress sync failed." });
  await enterLibrary(page);

  await expect(page.getByRole("alert")).toHaveText(
    "Playback progress could not be synchronized.",
  );
  await expect(page.getByRole("heading", { name: "All movies (1)" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Continue watching" })).toHaveCount(0);
});
