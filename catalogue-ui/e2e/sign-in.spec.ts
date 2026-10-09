import {
  account,
  expect,
  expectSignedIn,
  expectSignedOut,
  openLogin,
  submitLogin,
  test,
  wrongPassword,
} from "./account";

test("shows field errors for an empty sign-in and stays signed out", async ({
  page,
  accountApi,
}) => {
  await openLogin(page);

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Sign in" }).click();

  await expect(dialog.getByText("Email or username is required")).toBeVisible();
  await expect(dialog.getByText("Password is required")).toBeVisible();

  await dialog.getByRole("textbox", { name: "Email or username" }).fill("   ");
  await dialog.getByRole("button", { name: "Sign in" }).click();

  await expect(dialog.getByText("Email or username is required")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(accountApi.loginRequests).toEqual([]);

  await dialog.getByRole("button", { name: "close" }).click();
  await expectSignedOut(page);
});

test("shows a rejected sign-in and keeps the dialog open", async ({
  page,
  accountApi,
}) => {
  await openLogin(page);
  await submitLogin(page, account.email, wrongPassword);

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toHaveText("Incorrect password");
  await expect(dialog.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  expect(accountApi.loginRequests).toEqual([
    { email: account.email, password: wrongPassword, rememberMe: false },
  ]);

  await dialog.getByRole("button", { name: "close" }).click();
  await expectSignedOut(page);
});

test("signs in and shows the library", async ({ page, accountApi }) => {
  await openLogin(page);
  await submitLogin(page, `  ${account.email}  `, account.password);

  await expectSignedIn(page);
  expect(accountApi.loginRequests).toEqual([
    { email: account.email, password: account.password, rememberMe: false },
  ]);
});
