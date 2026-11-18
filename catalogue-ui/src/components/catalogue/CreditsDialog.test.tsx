import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import { CreditsDialog } from "./CreditsDialog";

const theme = createAppTheme();

function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

test("shows the TMDB credit and closes", async () => {
  const onClose = vi.fn();
  const screen = await render(<CreditsDialog open onClose={onClose} />, {
    wrapper: ThemeWrapper,
  });

  const dialog = screen.getByRole("dialog");
  await expect.element(dialog).toBeVisible();
  await expect.element(dialog.getByRole("heading", { name: "Credits" })).toBeVisible();
  await expect
    .element(dialog.getByText("This product uses the TMDB API but is not endorsed or certified by TMDB."))
    .toBeVisible();

  const tmdb = dialog.getByRole("link", { name: "TMDB" });
  await expect.element(tmdb).toHaveAttribute("href", "https://www.themoviedb.org");
  await expect.element(tmdb.getByRole("img", { name: "TMDB" })).toBeVisible();

  await dialog.getByRole("button", { name: "close" }).click();

  expect(onClose).toHaveBeenCalledOnce();
});
