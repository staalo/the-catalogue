import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import type { Media } from "@/types";
import { Hero } from "./Hero";

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

test("invites a signed-out viewer when nothing is featured", async () => {
  const screen = await render(
    <Hero featured={null} tab="movie" signedOut onPlay={vi.fn()} onMoreInfo={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("heading", { name: "the catalogue" })).toBeVisible();
  await expect
    .element(screen.getByText("Sign in to browse and watch your personal movie library."))
    .toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Play" })).not.toBeInTheDocument();
  await expect.element(screen.getByText("FEATURED MOVIE")).not.toBeInTheDocument();

  await screen.rerender(
    <Hero featured={null} tab="movie" signedOut={false} onPlay={vi.fn()} onMoreInfo={vi.fn()} />,
  );

  await expect.element(screen.getByRole("heading", { name: "the catalogue" })).toBeVisible();
  await expect
    .element(screen.getByText("Sign in to browse and watch your personal movie library."))
    .not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Play" })).not.toBeInTheDocument();
});

test("plays and opens a featured movie", async () => {
  const onPlay = vi.fn();
  const onMoreInfo = vi.fn();
  const screen = await render(
    <Hero featured={dune} tab="movie" signedOut={false} onPlay={onPlay} onMoreInfo={onMoreInfo} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByText("FEATURED MOVIE")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Dune" })).toBeVisible();
  await expect.element(screen.getByText(dune.description)).toBeVisible();

  await screen.getByRole("button", { name: "Play" }).click();
  await screen.getByRole("button", { name: "More info" }).click();

  expect(onPlay).toHaveBeenCalledOnce();
  expect(onPlay).toHaveBeenCalledWith(dune);
  expect(onMoreInfo).toHaveBeenCalledOnce();
  expect(onMoreInfo).toHaveBeenCalledWith(dune);
});

test("labels a featured series", async () => {
  const series: Media = { ...dune, id: 2, title: "The Expanse", type: "tv" };
  const screen = await render(
    <Hero featured={series} tab="tv" signedOut={false} onPlay={vi.fn()} onMoreInfo={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByText("FEATURED SERIES")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "The Expanse" })).toBeVisible();
  await expect.element(screen.getByText("FEATURED MOVIE")).not.toBeInTheDocument();
});
