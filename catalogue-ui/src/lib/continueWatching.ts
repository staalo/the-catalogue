/** A title at or above this percent has been watched and leaves Continue watching. */
export const FINISHED_PROGRESS = 95;

export type SeriesProgressEntry = {
  nodeId: number;
  seriesId: number;
  progress: number;
};

export function isContinueWatching(progress: number | undefined): boolean {
  return progress !== undefined && progress > 0 && progress < FINISHED_PROGRESS;
}

/**
 * Progress entries are newest first. The poster bar uses the newest episode,
 * version, or extra that is still in progress.
 */
export function continueProgressBySeries(
  entries: SeriesProgressEntry[],
): Map<number, number> {
  const progressBySeries = new Map<number, number>();
  for (const entry of entries) {
    if (entry.seriesId <= 0 || progressBySeries.has(entry.seriesId)) {
      continue;
    }
    if (isContinueWatching(entry.progress)) {
      progressBySeries.set(entry.seriesId, entry.progress);
    }
  }
  return progressBySeries;
}

/**
 * A series stays in Continue watching once any playback has started, until
 * every episode is finished. `episodeCount` is the catalogue episode total.
 * Playback rows at or above {@link FINISHED_PROGRESS} count as finished
 * episodes. Without a count, only a still-unfinished row keeps the series.
 */
export function seriesIdsToContinue(
  entries: SeriesProgressEntry[],
  episodeCountBySeries: ReadonlyMap<number, number> = new Map(),
): Set<number> {
  const bySeries = new Map<number, SeriesProgressEntry[]>();
  for (const entry of entries) {
    if (entry.seriesId <= 0) {
      continue;
    }
    const seriesEntries = bySeries.get(entry.seriesId);
    if (seriesEntries) {
      seriesEntries.push(entry);
    } else {
      bySeries.set(entry.seriesId, [entry]);
    }
  }

  const seriesIds = new Set<number>();
  for (const [seriesId, seriesEntries] of bySeries) {
    if (seriesEntries.some((entry) => isContinueWatching(entry.progress))) {
      seriesIds.add(seriesId);
      continue;
    }

    const finishedCount = seriesEntries.filter(
      (entry) => entry.progress >= FINISHED_PROGRESS,
    ).length;
    const episodeCount = episodeCountBySeries.get(seriesId) ?? 0;
    if (finishedCount > 0 && episodeCount > finishedCount) {
      seriesIds.add(seriesId);
    }
  }
  return seriesIds;
}

/**
 * The server list is newest first. A later copy of the same node is a newer
 * local update and moves to the front.
 */
export function orderSeriesProgress(entries: SeriesProgressEntry[]): SeriesProgressEntry[] {
  const latest = new Map<number, SeriesProgressEntry>();
  const firstOrder: number[] = [];
  const replaced: number[] = [];

  for (const entry of entries) {
    if (latest.has(entry.nodeId)) {
      if (!replaced.includes(entry.nodeId)) {
        replaced.push(entry.nodeId);
      }
    } else {
      firstOrder.push(entry.nodeId);
    }
    latest.set(entry.nodeId, entry);
  }

  const newestFirst = replaced
    .reverse()
    .map((nodeId) => latest.get(nodeId))
    .filter((entry): entry is SeriesProgressEntry => entry !== undefined);

  return [
    ...newestFirst,
    ...firstOrder
      .filter((nodeId) => !replaced.includes(nodeId))
      .map((nodeId) => latest.get(nodeId))
      .filter((entry): entry is SeriesProgressEntry => entry !== undefined),
  ];
}
