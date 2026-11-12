import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import type { Extra, Media, TvContentNode } from "@/types";
import { useWatchProgressStore } from "@/stores/useWatchProgressStore";
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

function tvNode(
  values: Partial<TvContentNode> & Pick<TvContentNode, "id" | "kind" | "label">,
): TvContentNode {
  return {
    title: null,
    runtime: null,
    overview: null,
    stillPath: null,
    url: null,
    seasonNumber: null,
    episodeNumber: null,
    children: [],
    ...values,
  };
}

const twinPeaks: Media = {
  id: 4,
  title: "Twin Peaks",
  type: "tv",
  year: "1990",
  meta: "2 seasons  ·  3 episodes",
  image: "",
  backdrop: "",
  description: "A town full of secrets.",
  genres: [{ id: 18, name: "Drama" }],
};

const twinPeaksNodes = [
  tvNode({
    id: 1,
    kind: "season",
    label: "1",
    seasonNumber: 1,
    children: [
      tvNode({
        id: 2,
        kind: "episode",
        label: "1",
        title: "Pilot",
        overview: "The body is found.",
        stillPath: "/pilot.jpg",
        seasonNumber: 1,
        episodeNumber: 1,
        children: [
          tvNode({
            id: 3,
            kind: "version",
            label: "Original",
            title: "Original",
            runtime: "1:30:09",
            url: "stream/tv/4/nodes/3/master.m3u8",
            seasonNumber: 1,
            episodeNumber: 1,
          }),
          tvNode({
            id: 4,
            kind: "version",
            label: "Alternate",
            title: "Alternate",
            runtime: "1:26:57",
            url: "stream/tv/4/nodes/4/master.m3u8",
            seasonNumber: 1,
            episodeNumber: 1,
          }),
        ],
      }),
      tvNode({
        id: 20,
        kind: "episode",
        label: "2",
        overview: "The investigation spreads.",
        runtime: "44:31",
        url: "stream/tv/4/nodes/20/master.m3u8",
        seasonNumber: 1,
        episodeNumber: 2,
      }),
    ],
  }),
  tvNode({
    id: 5,
    kind: "season",
    label: "2",
    seasonNumber: 2,
    children: [
      tvNode({
        id: 7,
        kind: "extras",
        label: "Extras",
        children: [
          tvNode({
            id: 8,
            kind: "media",
            label: "Deleted Scenes",
            title: "Deleted Scenes",
            runtime: "1:00",
            url: "stream/tv/4/nodes/8/deleted.mp4",
          }),
        ],
      }),
    ],
  }),
  tvNode({
    id: 9,
    kind: "extras",
    label: "Extras",
    children: [
      tvNode({
        id: 10,
        kind: "media",
        label: "A Slice of Lynch",
        title: "A Slice of Lynch",
        runtime: "30:02",
        url: "stream/tv/4/nodes/10/lynch.mp4",
      }),
    ],
  }),
];

test("lists both episode versions and separates season extras from series extras", async () => {
  useWatchProgressStore.setState({ tvProgressByNodeId: { 3: 40, 20: 100 } });
  const onPlaySeries = vi.fn();
  const screen = await render(
    <MediaDetailsDialog
      item={twinPeaks}
      seriesStatus="ready"
      seriesNodes={twinPeaksNodes}
      onClose={vi.fn()}
      onPlay={vi.fn()}
      onPlayExtra={vi.fn()}
      onPlaySeries={onPlaySeries}
    />,
    { wrapper: ThemeWrapper },
  );

  const dialog = screen.getByRole("dialog");
  const original = dialog.getByRole("article", { name: "Episode 1 · Pilot · Original" });
  const alternate = dialog.getByRole("article", { name: "Episode 1 · Pilot · Alternate" });

  await expect.element(dialog.getByRole("heading", { name: "Twin Peaks" })).toBeVisible();
  await expect.element(dialog.getByRole("button", { name: "Play now" })).not.toBeInTheDocument();
  await expect.element(original.getByText("The body is found.")).toBeVisible();
  await expect.element(alternate.getByText("The body is found.")).toBeVisible();
  await expect.element(original.getByText("1:30:09")).toBeVisible();
  await expect.element(alternate.getByText("1:26:57")).toBeVisible();
  await expect
    .element(original.getByRole("img", { name: "Episode 1 · Pilot · Original still" }))
    .toHaveAttribute("src", "https://image.tmdb.org/t/p/w300/pilot.jpg");
  await expect
    .element(alternate.getByRole("img", { name: "Episode 1 · Pilot · Alternate still" }))
    .toHaveAttribute("src", "https://image.tmdb.org/t/p/w300/pilot.jpg");
  const halfway = original.getByRole("progressbar", { name: "40% watched" });
  const unwatched = alternate.getByRole("progressbar", { name: "0% watched" });
  const finished = dialog
    .getByRole("article", { name: "Episode 2" })
    .getByRole("progressbar", { name: "100% watched" });
  await expect.element(halfway).toBeVisible();
  await expect.element(unwatched).toBeVisible();
  await expect.element(finished).toBeVisible();
  await expect.poll(() => progressFill(halfway.element())).toBeCloseTo(0.4, 2);
  await expect.poll(() => progressFill(unwatched.element())).toBe(0);
  await expect.poll(() => progressFill(finished.element())).toBeCloseTo(1, 2);
  expect(watchedColor(halfway.element())).toBe("rgb(59, 130, 246)");

  const seasonTwo = dialog.getByRole("region", { name: "Season 2" });
  await expect.element(seasonTwo.getByRole("button", { name: /Deleted Scenes/ })).toBeVisible();
  await expect
    .element(seasonTwo.getByRole("button", { name: /Slice of Lynch/ }))
    .not.toBeInTheDocument();

  const extras = dialog.getByRole("region", { name: "Extras" });
  await expect.element(extras.getByRole("button", { name: /Slice of Lynch/ })).toBeVisible();
  await expect
    .element(extras.getByRole("button", { name: /Deleted Scenes/ }))
    .not.toBeInTheDocument();

  await original.getByRole("button", { name: "Play Episode 1 · Pilot · Original" }).click();

  expect(onPlaySeries).toHaveBeenCalledOnce();
  expect(onPlaySeries).toHaveBeenCalledWith(
    expect.objectContaining({
      nodeId: 3,
      seriesId: 4,
      title: "Episode 1 · Pilot · Original",
      url: "/api/stream/tv/4/nodes/3/master.m3u8",
    }),
  );
});

test("says when a series cannot be loaded", async () => {
  const screen = await render(
    <MediaDetailsDialog
      item={twinPeaks}
      seriesStatus="error"
      onClose={vi.fn()}
      onPlay={vi.fn()}
      onPlayExtra={vi.fn()}
    />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByText("This series could not be loaded.")).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Play now" })).not.toBeInTheDocument();
});

test("stays closed when there is no item", async () => {
  const screen = await render(
    <MediaDetailsDialog item={null} onClose={vi.fn()} onPlay={vi.fn()} onPlayExtra={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("dialog")).not.toBeInTheDocument();
});

function progressFill(track: Element): number {
  const fill = track.firstElementChild;
  if (!(track instanceof HTMLElement) || !(fill instanceof HTMLElement)) {
    return -1;
  }

  const trackWidth = track.getBoundingClientRect().width;
  if (trackWidth === 0) {
    return -1;
  }

  return fill.getBoundingClientRect().width / trackWidth;
}

function watchedColor(track: Element): string {
  const fill = track.firstElementChild;
  return fill instanceof HTMLElement ? getComputedStyle(fill).backgroundColor : "";
}
