import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { usePlaybackProgress } from "@/hooks/usePlaybackProgress";
import { useWatchProgressStore } from "@/stores/useWatchProgressStore";

const playback = vi.hoisted(() => {
  const gate: { resolveTv: ((items: unknown[]) => void)[] } = {
    resolveTv: [],
  };

  return {
    gate,
    getMoviePlaybackProgress: vi.fn(async () => [
      { movieId: 7, progress: 40, updatedAt: "" },
    ]),
    getTvPlaybackProgress: vi.fn(
      () =>
        new Promise<unknown[]>((resolve) => {
          gate.resolveTv.push(resolve);
        }),
    ),
    getPendingTvPlaybackProgress: vi.fn(() => [] as unknown[]),
    queueTvPlaybackProgressUpdate: vi.fn(() => Promise.resolve()),
  };
});

vi.mock("@/api/playback", () => ({
  getMoviePlaybackProgress: playback.getMoviePlaybackProgress,
  getTvPlaybackProgress: playback.getTvPlaybackProgress,
  getPendingPlaybackProgress: () => [],
  getPendingTvPlaybackProgress: playback.getPendingTvPlaybackProgress,
  reconcilePendingPlaybackProgress: () => {},
  reconcilePendingTvPlaybackProgress: () => {},
  discardPendingPlaybackProgress: () => {},
  discardPendingTvPlaybackProgress: () => {},
  queueMoviePlaybackProgressUpdate: () => Promise.resolve(),
  queueTvPlaybackProgressUpdate: playback.queueTvPlaybackProgressUpdate,
  setPlaybackProgressSession: () => {},
}));

function QueryWrapper({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function ProgressStatus({ userName }: { userName?: string }) {
  const { isHydrated } = usePlaybackProgress(userName);
  return <p>{isHydrated ? "ready" : "loading"}</p>;
}

beforeEach(() => {
  playback.gate.resolveTv = [];
  playback.getMoviePlaybackProgress.mockClear();
  playback.getTvPlaybackProgress.mockClear();
  playback.getPendingTvPlaybackProgress.mockReset();
  playback.getPendingTvPlaybackProgress.mockReturnValue([]);
  playback.queueTvPlaybackProgressUpdate.mockClear();
  useWatchProgressStore.setState({
    progressById: {},
    tvProgressByNodeId: {},
    tvProgressEntries: [],
    hydratedFor: null,
    tvHydratedFor: null,
  });
});

test("stays loading until TV progress is stored", async () => {
  const screen = await render(<ProgressStatus userName="ada" />, {
    wrapper: QueryWrapper,
  });

  await expect.poll(() => useWatchProgressStore.getState().hydratedFor).toBe("ada");
  await expect.element(screen.getByText("loading")).toBeVisible();
  expect(useWatchProgressStore.getState().tvHydratedFor).toBeNull();
  expect(useWatchProgressStore.getState().progressById[7]).toBe(40);

  expect(playback.gate.resolveTv.length).toBeGreaterThan(0);
  const episodeProgress = [
    { nodeId: 3, seriesId: 1, progress: 25, updatedAt: "" },
  ];
  for (const resolveTv of playback.gate.resolveTv) {
    resolveTv(episodeProgress);
  }

  await expect.element(screen.getByText("ready")).toBeVisible();
  expect(useWatchProgressStore.getState().tvHydratedFor).toBe("ada");
  expect(useWatchProgressStore.getState().tvProgressByNodeId[3]).toBe(25);
  expect(useWatchProgressStore.getState().tvProgressEntries).toEqual([
    { nodeId: 3, seriesId: 1, progress: 25 },
  ]);
});

test("retries pending TV progress with the series id", async () => {
  playback.getPendingTvPlaybackProgress.mockReturnValue([
    { nodeId: 12, seriesId: 4, progress: 50, updatedAt: "" },
  ]);

  const screen = await render(<ProgressStatus userName="ada" />, {
    wrapper: QueryWrapper,
  });

  await expect.poll(() => playback.gate.resolveTv.length).toBeGreaterThan(0);
  for (const resolveTv of playback.gate.resolveTv) {
    resolveTv([]);
  }

  await expect.element(screen.getByText("ready")).toBeVisible();
  expect(playback.queueTvPlaybackProgressUpdate).toHaveBeenCalledWith("ada", 12, 50, 4);
});

test("is ready immediately when nobody is signed in", async () => {
  const screen = await render(<ProgressStatus />, { wrapper: QueryWrapper });

  await expect.element(screen.getByText("ready")).toBeVisible();
  expect(playback.getMoviePlaybackProgress).not.toHaveBeenCalled();
  expect(playback.getTvPlaybackProgress).not.toHaveBeenCalled();
});
