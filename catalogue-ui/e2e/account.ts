import { expect, test as base, type Page, type Route } from "@playwright/test";

export const account = {
  email: "ada@example.com",
  userName: "ada",
  password: "secret",
};

const registeredPassword = "Abcd1!";
const wrongPassword = "wrong-password";
const takenEmail = "taken@example.com";

type SessionUser = {
  email: string;
  userName: string;
};

type LoginBody = {
  email: string;
  password: string;
  rememberMe?: boolean;
};

type RegisterBody = {
  email: string;
  password: string;
  userName?: string;
};

export type AccountApi = {
  loginRequests: LoginBody[];
  registerRequests: RegisterBody[];
};

const dune = {
  id: 1,
  adult: false,
  homepage: null,
  imdbId: null,
  originalLanguage: "en",
  originalTitle: "Dune",
  overview: "A mythic and emotionally charged hero's journey.",
  popularity: 1,
  posterPath: null,
  backdropPath: null,
  releaseDate: "2021-10-22",
  runtime: 155,
  tagline: null,
  title: "Dune",
  voteAverage: 8,
  voteCount: 1,
  url: "https://example.test/dune.m3u8",
  hasExtras: false,
  cast: [],
  crew: [],
  genres: [{ id: 28, name: "Action" }],
  extras: [],
};

function fulfill(route: Route, status: number, body: unknown) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export async function installAccountApi(page: Page): Promise<AccountApi> {
  // Login and registration refetch the session, so this changes with those responses.
  let session: SessionUser | null = null;
  const api: AccountApi = { loginRequests: [], registerRequests: [] };

  await page.route("**/getcurrentuser", (route) => {
    if (!session) {
      return fulfill(route, 401, { error: "Unauthorized" });
    }

    return fulfill(route, 200, session);
  });

  await page.route("**/userlogin", (route) => {
    const body = route.request().postDataJSON() as LoginBody;
    api.loginRequests.push(body);

    if (body.password === wrongPassword) {
      return fulfill(route, 401, { error: "Incorrect password" });
    }

    session = { email: body.email, userName: account.userName };
    return fulfill(route, 200, { email: body.email });
  });

  await page.route("**/register", (route) => {
    const body = route.request().postDataJSON() as RegisterBody;
    api.registerRequests.push(body);

    if (body.email === takenEmail) {
      return fulfill(route, 400, { error: "Email is already registered" });
    }

    session = {
      email: body.email,
      userName: body.userName?.trim() || account.userName,
    };
    return fulfill(route, 200, session);
  });

  await page.route("**/logout", (route) => {
    session = null;
    return fulfill(route, 200, {});
  });

  await page.route("**/api/browse/browsemovies**", (route) =>
    fulfill(route, 200, {
      page: 1,
      results: [dune],
      totalPages: 1,
      totalResults: 1,
    }),
  );

  await page.route("**/api/playback/movies**", (route) => {
    if (route.request().method() === "GET") {
      return fulfill(route, 200, { items: [] });
    }

    return fulfill(route, 200, {
      movieId: dune.id,
      progress: 0,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  });

  await page.route("https://example.test/**", (route) => route.abort());

  return api;
}

export const test = base.extend<{ accountApi: AccountApi }>({
  accountApi: [
    async ({ page }, use) => {
      await use(await installAccountApi(page));
    },
    { auto: true },
  ],
});

export { expect, registeredPassword, takenEmail, wrongPassword };

export async function openLogin(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "log in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
}

export async function openRegister(page: Page) {
  await openLogin(page);
  await page.getByRole("button", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeHidden();
}

export async function submitLogin(page: Page, identifier: string, password: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Email or username" }).fill(identifier);
  await dialog.getByRole("textbox", { name: "Password" }).fill(password);
  await dialog.getByRole("button", { name: "Sign in" }).click();
}

export async function expectSignedIn(page: Page) {
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeHidden();
  await expect(page.getByRole("button", { name: "open profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "log out", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "log in", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: "Dune" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "All movies (1)" })).toBeVisible();
  await expect(page.getByText("Sign in to continue watching")).toHaveCount(0);
}

export async function expectSignedOut(page: Page) {
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "the catalogue" })).toBeVisible();
  await expect(page.getByText("Sign in to continue watching")).toBeVisible();
  await expect(page.getByRole("button", { name: "log in", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "log out", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "open profile" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: /all movies/i })).toHaveCount(0);
}

export async function signIn(page: Page) {
  await openLogin(page);
  await submitLogin(page, `  ${account.email}  `, account.password);
  await expectSignedIn(page);
}
