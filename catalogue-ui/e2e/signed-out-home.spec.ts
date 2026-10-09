import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/getcurrentuser", (route) =>
    route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized" }),
    }),
  );
});

test("signed-out visitor can open and close the login dialog", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "the catalogue" })).toBeVisible();
  await expect(
    page.getByText("Sign in to browse and watch your personal movie library."),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: "Movies" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "TV series" })).toBeVisible();
  await expect(page.getByPlaceholder("Search your library")).toBeVisible();
  await expect(page.getByText("Sign in to continue watching")).toBeVisible();
  await expect(page.getByRole("heading", { name: /all movies/i })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "log out", exact: true }),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "log in", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Email or username" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Password" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Create an account" })).toBeVisible();

  await dialog.getByRole("button", { name: "close" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "log in", exact: true }),
  ).toBeVisible();
});
