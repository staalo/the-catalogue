import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import type { Extra, Media } from "@/types";
import { MediaDetailsDialog } from "./MediaDetailsDialog";

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
  genres: [
    { id: 1, name: "Science Fiction" },
    { id: 2, name: "Adventure" },
  ],
};

const trailer: Extra = {
  id: 10,
  title: "Trailer",
  runtime: "2m",
  url: "/dune-trailer.mp4",
};

test("shows the movie details and plays it", async () => {
  const onPlay = vi.fn();
  const screen = await render(
    <MediaDetailsDialog item={dune} onClose={vi.fn()} onPlay={onPlay} onPlayExtra={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("dialog")).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Dune" })).toBeVisible();
  await expect.element(screen.getByText(/2021\s+·\s+2h 35m/)).toBeVisible();
  await expect.element(screen.getByText("Science Fiction")).toBeVisible();
  await expect.element(screen.getByText("Adventure")).toBeVisible();
  await expect.element(screen.getByText(dune.description)).toBeVisible();
  await expect.element(screen.getByRole("heading", { name: "Extras" })).not.toBeInTheDocument();

  await screen.getByRole("button", { name: "Play now" }).click();

  expect(onPlay).toHaveBeenCalledOnce();
  expect(onPlay).toHaveBeenCalledWith(dune);
});

test("plays an extra", async () => {
  const onPlayExtra = vi.fn();
  const item: Media = { ...dune, genres: [], extras: [trailer] };
  const screen = await render(
    <MediaDetailsDialog item={item} onClose={vi.fn()} onPlay={vi.fn()} onPlayExtra={onPlayExtra} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("heading", { name: "Extras" })).toBeVisible();
  await expect.element(screen.getByText("Science Fiction")).not.toBeInTheDocument();
  await expect.element(screen.getByText("2m")).toBeVisible();

  await screen.getByRole("button", { name: /trailer/i }).click();

  expect(onPlayExtra).toHaveBeenCalledOnce();
  expect(onPlayExtra).toHaveBeenCalledWith(item, trailer);
});

test("stays closed when there is no item", async () => {
  const screen = await render(
    <MediaDetailsDialog item={null} onClose={vi.fn()} onPlay={vi.fn()} onPlayExtra={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
});
