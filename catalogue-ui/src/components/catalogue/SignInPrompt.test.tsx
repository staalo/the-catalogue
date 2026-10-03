import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import { SignInPrompt } from "./SignInPrompt";

const theme = createAppTheme();

function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

test("asks the viewer to log in", async () => {
  const onLogin = vi.fn();
  const screen = await render(<SignInPrompt onLogin={onLogin} />, {
    wrapper: ThemeWrapper,
  });

  await expect.element(screen.getByText("Sign in to continue watching")).toBeVisible();
  await expect
    .element(screen.getByText("Your progress and library are waiting for you."))
    .toBeVisible();

  await screen.getByRole("button", { name: "Log in" }).click();

  expect(onLogin).toHaveBeenCalledOnce();
});
