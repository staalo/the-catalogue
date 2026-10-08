import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import type { PlayerTarget } from "@/types";
import { PlayerDialog } from "./PlayerDialog";

const theme = createAppTheme();

function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

const dune: PlayerTarget = {
  title: "Dune",
  subtitle: "2021  ·  2h 35m",
  url: "/dune.mp4",
  mediaId: 1,
  playbackUser: "ada",
};

function videoIn(screen: Awaited<ReturnType<typeof render>>) {
  return screen.getByRole("dialog").element().querySelector("video");
}

test("plays the title and closes", async () => {
  const onClose = vi.fn();
  const screen = await render(<PlayerDialog target={dune} onClose={onClose} />, {
    wrapper: ThemeWrapper,
  });

  await expect.element(screen.getByRole("dialog")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Dune" })).toBeVisible();
  await expect.element(screen.getByText(/2021\s+·\s+2h 35m/)).toBeVisible();
  await expect.poll(() => videoIn(screen)?.src ?? "").toContain("/dune.mp4");

  await screen.getByRole("button", { name: "close player" }).click();

  expect(onClose).toHaveBeenCalledOnce();
});

test("shows the title without a video when the url is missing", async () => {
  const screen = await render(
    <PlayerDialog target={{ ...dune, url: "" }} onClose={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("heading", { name: "Dune" })).toBeVisible();
  await expect.poll(() => videoIn(screen)).toBeNull();
});
