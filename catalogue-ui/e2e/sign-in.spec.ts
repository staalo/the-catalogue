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

test("keeps sign in disabled until the identifier and password are valid", async ({
  page,
  accountApi,
}) => {
  await openLogin(page);

  const dialog = page.getByRole("dialog");
  const signIn = dialog.getByRole("button", { name: "Sign in" });
  await expect(signIn).toBeDisabled();

  await dialog.getByRole("textbox", { name: "Email or username" }).fill(account.email);
  await expect(signIn).toBeDisabled();

  await dialog.getByRole("textbox", { name: "Password" }).fill("secret");
  await expect(signIn).toBeDisabled();

  await dialog.getByRole("textbox", { name: "Password" }).fill(account.password);
  await expect(signIn).toBeEnabled();

  await dialog.getByRole("textbox", { name: "Email or username" }).fill("   ");
  await expect(signIn).toBeDisabled();
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
  const alert = dialog.getByRole("alert");
  await expect(alert).toHaveText("Email/username or password was incorrect");
  await expect(dialog.getByRole("heading", { name: "Welcome back" })).toBeVisible();

  await dialog.getByRole("textbox", { name: "Email or username" }).click();
  await expect(alert).toBeHidden();

  await submitLogin(page, account.email, wrongPassword);
  await expect(dialog.getByRole("alert")).toBeVisible();
  await dialog.getByRole("textbox", { name: "Password" }).click();
  await expect(dialog.getByRole("alert")).toBeHidden();
  expect(accountApi.loginRequests).toEqual([
    { email: account.email, password: wrongPassword, rememberMe: false },
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
