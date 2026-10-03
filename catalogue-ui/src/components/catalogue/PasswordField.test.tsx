import type { ReactNode } from "react";
import type { ControllerRenderProps } from "react-hook-form";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import { PasswordField } from "./PasswordField";

const theme = createAppTheme();

function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

type PasswordForm = { password: string };

function passwordField(value: string): ControllerRenderProps<PasswordForm, "password"> {
  return {
    name: "password",
    value,
    onChange: vi.fn(),
    onBlur: vi.fn(),
    ref: vi.fn(),
  };
}

test("reveals and hides the password", async () => {
  const screen = await render(
    <PasswordField field={passwordField("secret")} autoComplete="current-password" />,
    { wrapper: ThemeWrapper },
  );

  const input = screen.getByRole("textbox", { name: /password/i });
  await expect.element(input).toHaveAttribute("type", "password");
  await expect.element(input).toHaveValue("secret");
  await expect.element(input).toHaveAttribute("autocomplete", "current-password");

  await screen.getByRole("button", { name: "Show password" }).click();

  await expect.element(input).toHaveAttribute("type", "text");
  await expect.element(screen.getByRole("button", { name: "Hide password" })).toBeVisible();

  await screen.getByRole("button", { name: "Hide password" }).click();

  await expect.element(input).toHaveAttribute("type", "password");
});

test("shows an error and helper text", async () => {
  const screen = await render(
    <PasswordField
      field={passwordField("")}
      autoComplete="new-password"
      error
      helperText="Password is required"
    />,
    { wrapper: ThemeWrapper },
  );

  const input = screen.getByRole("textbox", { name: /password/i });
  await expect.element(input).toHaveAttribute("aria-invalid", "true");
  await expect.element(input).toHaveAttribute("autocomplete", "new-password");
  await expect.element(screen.getByText("Password is required")).toBeVisible();
});
