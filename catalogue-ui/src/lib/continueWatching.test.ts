import { expect, test } from 'vitest';
import {
  continueProgressBySeries,
  isContinueWatching,
  orderSeriesProgress,
  seriesIdsToContinue,
  type SeriesProgressEntry,
} from '@/lib/continueWatching';

function entry(
  nodeId: number,
  seriesId: number,
  progress: number,
): SeriesProgressEntry {
  return { nodeId, seriesId, progress };
}

test('keeps a series while any of its episodes is unfinished', () => {
  const progress = continueProgressBySeries([
    entry(2, 9, 100),
    entry(1, 9, 40),
    entry(3, 8, 95),
    entry(4, 7, 0),
  ]);

  expect(progress.get(9)).toBe(40);
  expect(progress.has(8)).toBe(false);
  expect(progress.has(7)).toBe(false);
  expect(isContinueWatching(40)).toBe(true);
  expect(isContinueWatching(95)).toBe(false);
});

test('keeps a started series until every episode is finished', () => {
  const episodeCounts = new Map<number, number>([
    [9, 3],
    [8, 2],
    [7, 1],
  ]);
  const watching = seriesIdsToContinue(
    [
      entry(2, 9, 100),
      entry(1, 8, 100),
      entry(3, 8, 40),
      entry(4, 7, 95),
    ],
    episodeCounts,
  );

  expect(watching.has(9)).toBe(true);
  expect(watching.has(8)).toBe(true);
  expect(watching.has(7)).toBe(false);
  expect(continueProgressBySeries([entry(2, 9, 100)]).has(9)).toBe(false);
});

test('leaves a series out when the episode count is unknown and nothing is unfinished', () => {
  expect(seriesIdsToContinue([entry(1, 9, 100)]).has(9)).toBe(false);
});

test('uses the newest in-progress episode for the series bar', () => {
  const progress = continueProgressBySeries([
    entry(2, 9, 80),
    entry(1, 9, 10),
  ]);

  expect(progress.get(9)).toBe(80);
});

test('treats a repeated node as a newer update', () => {
  const ordered = orderSeriesProgress([
    entry(1, 9, 10),
    entry(2, 9, 20),
    entry(1, 9, 40),
  ]);

  expect(ordered).toEqual([entry(1, 9, 40), entry(2, 9, 20)]);
  expect(continueProgressBySeries(ordered).get(9)).toBe(40);
});
