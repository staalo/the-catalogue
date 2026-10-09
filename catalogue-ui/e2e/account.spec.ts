import type { Page } from "@playwright/test";
import {
  account,
  expect,
  expectSignedIn,
  expectSignedOut,
  openLogin,
  openRegister,
  registeredPassword,
  signIn,
  takenEmail,
  test,
} from "./account";

const passwordHint =
  "At least 6 characters, with uppercase, lowercase, a number, and a symbol.";

test("switches between sign-in and registration", async ({ page }) => {
  await openLogin(page);
  await page.getByRole("button", { name: "Create an account" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Create an account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeHidden();

  await dialog.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create an account" })).toBeHidden();
  await dialog.getByRole("button", { name: "close" }).click();
  await expectSignedOut(page);
});

test("explains invalid registration details", async ({ page, accountApi }) => {
  await openRegister(page);

  const dialog = page.getByRole("dialog");
  const email = dialog.getByRole("textbox", { name: "Email" });
  const password = dialog.getByRole("textbox", { name: "Password" });

  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByText("Email is required")).toBeVisible();

  await email.fill("   ");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByText("Email is required")).toBeVisible();

  await email.fill("ada");
  await dialog.getByRole("button", { name: "Create account" }).click();
  await expect(dialog.getByText("Enter a valid email")).toBeVisible();

  await expect(dialog.getByText(passwordHint)).toBeVisible();
  await password.fill("Ab1!");
  await expect(dialog.getByText("Password must be at least 6 characters.")).toBeVisible();
  await password.fill("Abcde1");
  await expect(dialog.getByText("Password must include a symbol.")).toBeVisible();
  await password.fill("Abcde!");
  await expect(dialog.getByText("Password must include a number.")).toBeVisible();
  await password.fill("ABCD1!");
  await expect(dialog.getByText("Password must include a lowercase letter.")).toBeVisible();
  await password.fill("abcd1!");
  await expect(dialog.getByText("Password must include an uppercase letter.")).toBeVisible();
  await password.fill(registeredPassword);
  await expect(dialog.getByText(passwordHint)).toBeVisible();
  await expect(dialog.getByText("Password must include an uppercase letter.")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();
  expect(accountApi.registerRequests).toEqual([]);
});

test("shows a rejected registration and keeps the dialog open", async ({
  page,
  accountApi,
}) => {
  await openRegister(page);

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Email" }).fill(takenEmail);
  await dialog.getByRole("textbox", { name: "Password" }).fill(registeredPassword);
  await dialog.getByRole("button", { name: "Create account" }).click();

  await expect(dialog.getByRole("alert")).toHaveText("Email is already registered");
  await expect(dialog.getByRole("heading", { name: "Create an account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "open profile" })).toHaveCount(0);
  expect(accountApi.registerRequests).toEqual([
    { email: takenEmail, password: registeredPassword },
  ]);
});

test("creates an account and shows the library", async ({ page, accountApi }) => {
  await openRegister(page);

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Email" }).fill(`  ${account.email}  `);
  await dialog.getByRole("textbox", { name: "Password" }).fill(registeredPassword);
  await dialog.getByRole("textbox", { name: "Username" }).fill("  Ada  ");
  await dialog.getByRole("button", { name: "Create account" }).click();

  await expectSignedIn(page);
  await page.getByRole("button", { name: "open profile" }).click();
  const profile = page.getByRole("dialog");
  await expect(profile.getByRole("heading", { name: "Your profile" })).toBeVisible();
  await expect(profile.getByRole("textbox", { name: "Email" })).toHaveValue(account.email);
  await expect(profile.getByRole("textbox", { name: "Username" })).toHaveValue("Ada");

  expect(accountApi.registerRequests).toEqual([
    { email: account.email, password: registeredPassword, userName: "Ada" },
  ]);
});

test("shows the profile and closes it without signing out", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "open profile" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Your profile" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "Email" })).toHaveValue(account.email);
  await expect(dialog.getByRole("textbox", { name: "Username" })).toHaveValue(account.userName);

  await dialog.getByRole("button", { name: "close" }).click();
  await expect(dialog).toBeHidden();
  await expectSignedIn(page);
});

test("logs out to the signed-out home", async ({ page }) => {
  await signIn(page);
  await page.getByRole("button", { name: "log out", exact: true }).click();
  await expectSignedOut(page);
});

async function clickOutsideDialog(page: Page) {
  await page.locator(".MuiDialog-container").click({ position: { x: 8, y: 8 } });
}

test("closes an open dialog before logging out", async ({ page }) => {
  await signIn(page);

  await page.getByRole("button", { name: "open profile" }).click();
  const profile = page.getByRole("dialog");
  await expect(profile.getByRole("heading", { name: "Your profile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "log out", exact: true })).toHaveCount(0);
  await clickOutsideDialog(page);
  await expect(profile).toBeHidden();
  await expectSignedIn(page);

  await page.getByRole("button", { name: "More info" }).click();
  const details = page.getByRole("dialog");
  await expect(details.getByRole("heading", { name: "Dune" })).toBeVisible();
  await expect(page.getByRole("button", { name: "log out", exact: true })).toHaveCount(0);
  await clickOutsideDialog(page);
  await expect(details).toBeHidden();
  await expectSignedIn(page);

  await page.getByRole("button", { name: "Play" }).click();
  const player = page.getByRole("dialog");
  await expect(player.getByRole("button", { name: "close player" })).toBeVisible();
  await expect(page.getByRole("button", { name: "log out", exact: true })).toHaveCount(0);
  await clickOutsideDialog(page);
  await expect(player).toBeHidden();
  await expectSignedIn(page);

  await page.getByRole("button", { name: "log out", exact: true }).click();
  await expectSignedOut(page);
});
