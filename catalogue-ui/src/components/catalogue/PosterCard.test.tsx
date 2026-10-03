import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import type { Media } from "@/types";
import { PosterCard } from "./PosterCard";

const theme = createAppTheme();

function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

const dune: Media = {
  id: 1,
  title: "Dune",
  type: "movie",
  year: "2021",
  meta: "2h 35m",
  image: "/dune.jpg",
  backdrop: "/dune-backdrop.jpg",
  description: "A noble family becomes embroiled in a war.",
  genres: [],
};

test("opens the item when the poster is clicked", async () => {
  const onOpen = vi.fn();

  const screen = await render(<PosterCard item={dune} onOpen={onOpen} />, {
    wrapper: ThemeWrapper,
  });

  await expect
    .element(screen.getByRole("img", { name: "Dune poster" }))
    .toBeVisible();
  await expect.element(screen.getByText("2021  ·  2h 35m")).toBeVisible();

  await screen.getByRole("button", { name: /dune/i }).click();

  expect(onOpen).toHaveBeenCalledOnce();
  expect(onOpen).toHaveBeenCalledWith(dune);
});

test("shows how much of the item has been watched", async () => {
  const screen = await render(
    <PosterCard item={{ ...dune, progress: 40 }} onOpen={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect
    .element(screen.getByRole("img", { name: "Dune poster" }))
    .toBeVisible();

  await expect.poll(() => progressFillRatio(screen)).toBeCloseTo(0.4, 2);
});

test("omits the poster image when the item has none", async () => {
  const screen = await render(
    <PosterCard item={{ ...dune, image: "" }} onOpen={vi.fn()} />,
    {
      wrapper: ThemeWrapper,
    },
  );

  await expect
    .element(screen.getByRole("button", { name: /dune/i }))
    .toBeVisible();
  await expect.element(screen.getByRole("img")).not.toBeInTheDocument();
});

function progressFillRatio(screen: Awaited<ReturnType<typeof render>>): number {
  const poster = screen
    .getByRole("button", { name: /dune/i })
    .element()
    .querySelector(".poster");
  const track = poster?.querySelector(":scope > div");
  const fill = track?.firstElementChild;
  if (!(track instanceof HTMLElement) || !(fill instanceof HTMLElement)) {
    return 0;
  }

  const trackWidth = track.getBoundingClientRect().width;
  if (trackWidth === 0) {
    return 0;
  }

  return fill.getBoundingClientRect().width / trackWidth;
}
