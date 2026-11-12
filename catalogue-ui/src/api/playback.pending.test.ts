import { afterEach, expect, test } from "vitest";
import {
  getPendingTvPlaybackProgress,
  queueTvPlaybackProgressUpdate,
  reconcilePendingTvPlaybackProgress,
  setPlaybackProgressSession,
} from "@/api/playback";

const TV_PENDING_PROGRESS_KEY = "catalogue-pending-tv-playback-progress-v1";

afterEach(() => {
  window.localStorage.removeItem(TV_PENDING_PROGRESS_KEY);
  setPlaybackProgressSession(undefined);
});

test("keeps the series id with pending TV progress", () => {
  setPlaybackProgressSession("other");
  queueTvPlaybackProgressUpdate("ada", 12, 40, 9);
  queueTvPlaybackProgressUpdate("ada", 13, 10, 9);

  expect(getPendingTvPlaybackProgress("ada")).toEqual([
    { nodeId: 12, seriesId: 9, progress: 40, updatedAt: "" },
    { nodeId: 13, seriesId: 9, progress: 10, updatedAt: "" },
  ]);

  reconcilePendingTvPlaybackProgress("ada", [
    { nodeId: 12, seriesId: 9, progress: 40, updatedAt: "2026-01-01T00:00:00.000Z" },
  ]);

  expect(getPendingTvPlaybackProgress("ada")).toEqual([
    { nodeId: 13, seriesId: 9, progress: 10, updatedAt: "" },
  ]);
});

test("ignores pending TV progress that has no series id", () => {
  window.localStorage.setItem(
    TV_PENDING_PROGRESS_KEY,
    JSON.stringify({
      "user:ada": {
        "8": 15,
        "12": { seriesId: 0, progress: 20 },
        "13": { seriesId: 9, progress: 40 },
      },
    }),
  );

  expect(getPendingTvPlaybackProgress("ada")).toEqual([
    { nodeId: 13, seriesId: 9, progress: 40, updatedAt: "" },
  ]);
});
