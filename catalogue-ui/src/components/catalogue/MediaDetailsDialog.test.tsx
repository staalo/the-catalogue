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

test("shows watched time between the overview and play", async () => {
  useWatchProgressStore.setState({ progressById: { 1: 40 } });
  const item: Media = { ...dune, runtimeMinutes: 155 };
  const screen = await render(
    <MediaDetailsDialog item={item} onClose={vi.fn()} onPlay={vi.fn()} onPlayExtra={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  const dialog = screen.getByRole("dialog");
  const overview = dialog.getByText(dune.description);
  const bar = dialog.getByRole("progressbar", { name: "40% watched" });
  const play = dialog.getByRole("button", { name: "Continue" });
  await expect.element(dialog.getByRole("button", { name: "Play now" })).not.toBeInTheDocument();
  const watched = dialog.getByText("1h 2m / 2h 35m");

  await expect.element(bar).toBeVisible();
  await expect.element(watched).toBeVisible();
  await expect.poll(() => progressFill(bar.element())).toBeCloseTo(0.4, 2);
  expect(watchedColor(bar.element())).toBe("rgb(59, 130, 246)");
  expect(isBefore(overview.element(), bar.element())).toBe(true);
  expect(isBefore(bar.element(), play.element())).toBe(true);
  await expect.poll(() => watched.element().getBoundingClientRect().left)
    .toBeGreaterThanOrEqual(bar.element().getBoundingClientRect().right - 1);
});

test("hides the movie bar when nothing has been watched", async () => {
  useWatchProgressStore.setState({ progressById: {} });
  const item: Media = { ...dune, runtimeMinutes: 155 };
  const screen = await render(
    <MediaDetailsDialog item={item} onClose={vi.fn()} onPlay={vi.fn()} onPlayExtra={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("progressbar")).not.toBeInTheDocument();
  await expect.element(screen.getByText("0m / 2h 35m")).not.toBeInTheDocument();
  await expect.element(screen.getByRole("button", { name: "Play now" })).toBeVisible();
});

test("keeps play now when the movie is finished", async () => {
  useWatchProgressStore.setState({ progressById: { 1: 95 } });
  const screen = await render(
    <MediaDetailsDialog
      item={{ ...dune, runtimeMinutes: 155 }}
      onClose={vi.fn()}
      onPlay={vi.fn()}
      onPlayExtra={vi.fn()}
    />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("button", { name: "Play now" })).toBeVisible();
  await expect.element(screen.getByRole("button", { name: "Continue" })).not.toBeInTheDocument();
  await expect.element(screen.getByRole("progressbar")).not.toBeInTheDocument();
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
  const extraButton = screen.getByRole("button", { name: /trailer/i });
  const runtime = screen.getByText("2m");
  await expect.element(runtime).toBeVisible();
  await expect
    .element(screen.getByRole("progressbar", { name: "50% watched" }))
    .not.toBeInTheDocument();
  await expect.poll(() => extraRowSpansContent(extraButton.element())).toBe(true);
  await expect.poll(() => runtimeSitsOnTheRight(extraButton.element(), runtime.element())).toBe(true);

  await extraButton.click();

  expect(onPlayExtra).toHaveBeenCalledOnce();
  expect(onPlayExtra).toHaveBeenCalledWith(item, trailer);
});

test("shows an unwatched extra runtime in movie format", async () => {
  const featurette: Extra = { ...trailer, runtime: "8:46" };
  const item: Media = { ...dune, genres: [], extras: [featurette] };
  const screen = await render(
    <MediaDetailsDialog item={item} onClose={vi.fn()} onPlay={vi.fn()} onPlayExtra={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByText("8m 46s")).toBeVisible();
  await expect.element(screen.getByText("8:46")).not.toBeInTheDocument();
});

test("shows a progress bar under a partly watched extra", async () => {
  useWatchProgressStore.setState({ extraProgressById: { 10: 50 }, progressById: {} });
  const featurette: Extra = { ...trailer, runtime: "8:46" };
  const item: Media = { ...dune, genres: [], extras: [featurette] };
  const screen = await render(
    <MediaDetailsDialog item={item} onClose={vi.fn()} onPlay={vi.fn()} onPlayExtra={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  const title = screen.getByRole("button", { name: /trailer/i });
  const bar = screen.getByRole("progressbar", { name: "50% watched" });
  const watched = screen.getByText("4m 23s / 8m 46s");
  await expect.element(bar).toBeVisible();
  await expect.element(watched).toBeVisible();
  await expect.element(screen.getByText("8:46")).not.toBeInTheDocument();
  await expect.poll(() => progressFill(bar.element())).toBeCloseTo(0.5, 2);
  expect(watchedColor(bar.element())).toBe("rgb(59, 130, 246)");
  expect(title.element().contains(bar.element())).toBe(true);
  expect(title.element().contains(watched.element())).toBe(true);
  await expect.poll(() => fitsInside(title.element(), bar.element())).toBe(true);
});

test("hides the extra progress bar when the extra is finished", async () => {
  useWatchProgressStore.setState({ extraProgressById: { 10: 100 }, progressById: {} });
  const item: Media = { ...dune, genres: [], extras: [trailer] };
  const screen = await render(
    <MediaDetailsDialog item={item} onClose={vi.fn()} onPlay={vi.fn()} onPlayExtra={vi.fn()} />,
    { wrapper: ThemeWrapper },
  );

  await expect.element(screen.getByRole("button", { name: /trailer/i })).toBeVisible();
  await expect
    .element(screen.getByRole("progressbar", { name: "100% watched" }))
    .not.toBeInTheDocument();
  await expect.element(screen.getByText("2m")).toBeVisible();
});

function fitsInside(container: Element, child: Element): boolean {
  const outer = container.getBoundingClientRect();
  const inner = child.getBoundingClientRect();
  return (
    inner.top > outer.top
    && inner.bottom < outer.bottom
    && inner.left > outer.left
    && inner.right < outer.right
  );
}

function extraRowSpansContent(button: Element): boolean {
  const content = button.closest(".MuiDialogContent-root");
  if (!content) {
    return false;
  }

  const contentBox = content.getBoundingClientRect();
  const buttonBox = button.getBoundingClientRect();
  const style = getComputedStyle(content);
  const padLeft = Number.parseFloat(style.paddingLeft);
  const padRight = Number.parseFloat(style.paddingRight);
  return (
    Math.abs(buttonBox.left - (contentBox.left + padLeft)) < 1
    && Math.abs(buttonBox.right - (contentBox.right - padRight)) < 1
  );
}

function runtimeSitsOnTheRight(button: Element, runtime: Element): boolean {
  const buttonBox = button.getBoundingClientRect();
  const runtimeBox = runtime.getBoundingClientRect();
  return buttonBox.right - runtimeBox.right < 24 && runtimeBox.left > buttonBox.left + buttonBox.width / 2;
}

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

const tvSeries: Media = {
  id: 4,
  title: "TV Series 2",
  type: "tv",
  year: "2000",
  meta: "2 seasons  ·  3 episodes",
  image: "",
  backdrop: "",
  description: "A short series overview.",
  genres: [{ id: 18, name: "Drama" }],
};

const tvSeriesNodes = [
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
        overview: "The story begins.",
        stillPath: "/pilot.jpg",
        seasonNumber: 1,
        episodeNumber: 1,
        children: [
          tvNode({
            id: 3,
            kind: "version",
            label: "Original",
            title: "Original",
            runtime: "45:00",
            url: "stream/tv/4/nodes/3/master.m3u8",
            seasonNumber: 1,
            episodeNumber: 1,
          }),
          tvNode({
            id: 4,
            kind: "version",
            label: "Alternate",
            title: "Alternate",
            runtime: "42:00",
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
        overview: "The story continues.",
        runtime: "45:00",
        url: "stream/tv/4/nodes/20/master.m3u8",
        seasonNumber: 1,
        episodeNumber: 2,
      }),
      tvNode({
        id: 21,
        kind: "extras",
        label: "Extras",
        children: [
          tvNode({
            id: 22,
            kind: "media",
            label: "Bonus Feature",
            title: "Bonus Feature",
            runtime: "10:00",
            url: "stream/tv/4/nodes/22/log-lady.mp4",
          }),
        ],
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
            runtime: "5:00",
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
        label: "Featurette",
        title: "Featurette",
        runtime: "15:00",
        url: "stream/tv/4/nodes/10/lynch.mp4",
      }),
    ],
  }),
];

test("lists both episode versions and separates season extras from series extras", async () => {
  useWatchProgressStore.setState({
    tvProgressByNodeId: { 3: 40, 20: 100, 22: 50 },
    tvProgressEntries: [
      { nodeId: 22, seriesId: 4, progress: 50 },
      { nodeId: 3, seriesId: 4, progress: 40 },
      { nodeId: 20, seriesId: 4, progress: 100 },
    ],
  });
  const onPlaySeries = vi.fn();
  const screen = await render(
    <MediaDetailsDialog
      item={tvSeries}
      seriesStatus="ready"
      seriesNodes={tvSeriesNodes}
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

  await expect.element(dialog.getByRole("heading", { name: "TV Series 2" })).toBeVisible();
  const start = dialog.getByRole("region", { name: "Start watching" });
  const continueWatching = start.getByRole("button", { name: "Continue" });
  await expect.element(continueWatching).toBeVisible();
  await expect.element(start.getByRole("progressbar", { name: "40% watched" })).toBeVisible();
  await expect.element(start.getByText("18m / 45m")).toBeVisible();
  await expect.element(dialog.getByRole("button", { name: "Play now" })).not.toBeInTheDocument();
  await expect.element(dialog.getByRole("button", { name: "Next episode" })).not.toBeInTheDocument();
  expect(isBefore(dialog.getByText(tvSeries.description).element(), start.element())).toBe(true);
  expect(isBefore(start.element(), dialog.getByRole("region", { name: "Season 1" }).element())).toBe(
    true,
  );
  expect(
    isBefore(
      start.getByRole("progressbar", { name: "40% watched" }).element(),
      continueWatching.element(),
    ),
  ).toBe(true);
  await expect.element(original.getByText("The story begins.")).toBeVisible();
  await expect.element(alternate.getByText("The story begins.")).toBeVisible();
  await expect.element(original.getByText("18m / 45m")).toBeVisible();
  await expect.element(alternate.getByText("0m / 42m")).not.toBeInTheDocument();
  await expect.element(alternate.getByText("42m", { exact: true })).toBeVisible();
  await expect
    .element(dialog.getByRole("article", { name: "Episode 2" }).getByText("45m / 45m"))
    .toBeVisible();
  await expect.element(dialog.getByText("5m / 10m")).toBeVisible();
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
  const halfwayTime = original.getByText("18m / 45m");
  await expect.poll(() => halfwayTime.element().getBoundingClientRect().left)
    .toBeGreaterThanOrEqual(halfway.element().getBoundingClientRect().right - 1);

  const seasonOne = dialog.getByRole("region", { name: "Season 1" });
  const seasonTwo = dialog.getByRole("region", { name: "Season 2" });
  const seasonOneExtras = seasonOne.getByRole("heading", { name: "Season 1 - Extras" });
  const seasonTwoTitle = seasonTwo.getByRole("heading", { name: "Season 2", exact: true });
  const seasonTwoExtras = seasonTwo.getByRole("heading", { name: "Season 2 - Extras" });
  await expect.element(seasonOneExtras).toBeVisible();
  await expect.element(seasonOne.getByRole("button", { name: /Bonus Feature/ })).toBeVisible();
  await expect.element(seasonTwoExtras).toBeVisible();
  await expect.element(seasonTwo.getByRole("button", { name: /Deleted Scenes/ })).toBeVisible();
  await expect
    .element(seasonTwo.getByRole("button", { name: /Featurette/ }))
    .not.toBeInTheDocument();

  const extras = dialog.getByRole("region", { name: "Extras" });
  const seriesExtras = extras.getByRole("heading", { name: "Extras", exact: true });
  expect(isBefore(seasonOneExtras.element(), seasonTwoTitle.element())).toBe(true);
  expect(isBefore(seasonTwoTitle.element(), seasonTwoExtras.element())).toBe(true);
  expect(isBefore(seasonTwoExtras.element(), seriesExtras.element())).toBe(true);
  await expect.element(extras.getByRole("button", { name: /Featurette/ })).toBeVisible();
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

test("plays the first episode when nothing has been watched", async () => {
  useWatchProgressStore.setState({ tvProgressByNodeId: {}, tvProgressEntries: [] });
  const onPlaySeries = vi.fn();
  const screen = await render(
    <MediaDetailsDialog
      item={tvSeries}
      seriesStatus="ready"
      seriesNodes={tvSeriesNodes}
      onClose={vi.fn()}
      onPlay={vi.fn()}
      onPlayExtra={vi.fn()}
      onPlaySeries={onPlaySeries}
    />,
    { wrapper: ThemeWrapper },
  );

  const start = screen.getByRole("region", { name: "Start watching" });
  const playNow = start.getByRole("button", { name: "Play now" });
  await expect.element(playNow).toBeVisible();
  await expect.element(start.getByRole("progressbar")).not.toBeInTheDocument();
  expect(isBefore(screen.getByText(tvSeries.description).element(), start.element())).toBe(true);

  await playNow.click();

  expect(onPlaySeries).toHaveBeenCalledOnce();
  expect(onPlaySeries).toHaveBeenCalledWith(
    expect.objectContaining({ nodeId: 3, seriesId: 4, title: "Episode 1 · Pilot · Original" }),
  );
});

test("plays the next episode when earlier episodes are finished", async () => {
  useWatchProgressStore.setState({
    tvProgressByNodeId: { 3: 100 },
    tvProgressEntries: [{ nodeId: 3, seriesId: 4, progress: 100 }],
  });
  const onPlaySeries = vi.fn();
  const screen = await render(
    <MediaDetailsDialog
      item={tvSeries}
      seriesStatus="ready"
      seriesNodes={tvSeriesNodes}
      onClose={vi.fn()}
      onPlay={vi.fn()}
      onPlayExtra={vi.fn()}
      onPlaySeries={onPlaySeries}
    />,
    { wrapper: ThemeWrapper },
  );

  const start = screen.getByRole("region", { name: "Start watching" });
  await expect.element(start.getByRole("progressbar")).not.toBeInTheDocument();
  await expect.element(start.getByRole("button", { name: "Play now" })).not.toBeInTheDocument();

  await start.getByRole("button", { name: "Next episode" }).click();

  expect(onPlaySeries).toHaveBeenCalledOnce();
  expect(onPlaySeries).toHaveBeenCalledWith(
    expect.objectContaining({ nodeId: 20, seriesId: 4, title: "Episode 2" }),
  );
});

test("says when a series cannot be loaded", async () => {
  const screen = await render(
    <MediaDetailsDialog
      item={tvSeries}
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

function isBefore(earlier: Element, later: Element): boolean {
  return (earlier.compareDocumentPosition(later) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
}

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
