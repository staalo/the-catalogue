import { expect, test } from "vitest";
import { mapSeriesToMedia } from "@/lib/media";
import { listSeriesContent, nextEpisodePlayback, seriesPlayTarget } from "@/lib/seriesListing";
import type { SeriesSummary, TvContentNode } from "@/types";

function node(
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

const twinPeaks = [
  node({
    id: 1,
    kind: "season",
    label: "1",
    seasonNumber: 1,
    children: [
      node({
        id: 2,
        kind: "episode",
        label: "1",
        title: "Pilot",
        overview: "The body is found.",
        stillPath: "/pilot.jpg",
        seasonNumber: 1,
        episodeNumber: 1,
        children: [
          node({
            id: 3,
            kind: "version",
            label: "Original",
            title: "Original",
            runtime: "1:30:09",
            overview: "Do not use this cut's synopsis.",
            stillPath: "/original-only.jpg",
            url: "stream/tv/4/nodes/3/master.m3u8",
            seasonNumber: 1,
            episodeNumber: 1,
          }),
          node({
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
      node({
        id: 5,
        kind: "episode",
        label: "2",
        title: null,
        runtime: "44:31",
        overview: "The investigation spreads.",
        url: "stream/tv/4/nodes/5/master.m3u8",
        seasonNumber: 1,
        episodeNumber: 2,
      }),
    ],
  }),
  node({
    id: 6,
    kind: "season",
    label: "2",
    seasonNumber: 2,
    children: [
      node({
        id: 7,
        kind: "extras",
        label: "Extras",
        seasonNumber: 2,
        children: [
          node({
            id: 8,
            kind: "media",
            label: "1",
            title: "Deleted Scenes",
            runtime: "1:00",
            url: "stream/tv/4/nodes/8/deleted.mp4",
            seasonNumber: 2,
          }),
        ],
      }),
    ],
  }),
  node({
    id: 9,
    kind: "extras",
    label: "Extras",
    children: [
      node({
        id: 10,
        kind: "media",
        label: "A Slice of Lynch",
        title: "A Slice of Lynch",
        runtime: "30:02",
        url: "stream/tv/4/nodes/10/lynch.mp4",
      }),
      node({
        id: 11,
        kind: "group",
        label: "Secrets From Another Place",
        title: "Secrets From Another Place",
        children: [
          node({
            id: 12,
            kind: "media",
            label: "Creating Season One",
            title: "Creating Season One",
            runtime: "30:38",
            url: "stream/tv/4/nodes/12/season-one.mp4",
          }),
        ],
      }),
    ],
  }),
];

test("copies sidecar subtitles onto episode and extra playback", () => {
  const content = listSeriesContent(
    "Twin Peaks",
    [
      node({
        id: 1,
        kind: "season",
        label: "1",
        seasonNumber: 1,
        children: [
          node({
            id: 5,
            kind: "episode",
            label: "1",
            episodeNumber: 1,
            url: "stream/tv/4/nodes/5/episode.mp4",
            subtitles: [
              { language: "en", label: "English", url: "stream/tv/4/nodes/5/episode-en.vtt" },
              { language: "fi", label: "Finnish", url: "stream/tv/4/nodes/5/episode-fi.vtt" },
            ],
          }),
          node({
            id: 8,
            kind: "media",
            label: "Deleted Scenes",
            title: "Deleted Scenes",
            url: "stream/tv/4/nodes/8/deleted.mp4",
            subtitles: [
              { language: "en", label: "English", url: "stream/tv/4/nodes/8/deleted-en.vtt" },
            ],
          }),
        ],
      }),
    ],
    4,
  );

  expect(content.seasons[0]?.episodes[0]?.playback?.subtitles).toEqual([
    { language: "en", label: "English", url: "/api/stream/tv/4/nodes/5/episode-en.vtt" },
    { language: "fi", label: "Finnish", url: "/api/stream/tv/4/nodes/5/episode-fi.vtt" },
  ]);
  expect(content.seasons[0]?.extras[0]?.playback?.subtitles).toEqual([
    { language: "en", label: "English", url: "/api/stream/tv/4/nodes/8/deleted-en.vtt" },
  ]);
});

test("gives every cut the episode overview, title, and still", () => {
  const content = listSeriesContent("Twin Peaks", twinPeaks, 4);
  const [original, alternate] = content.seasons[0]?.episodes ?? [];

  expect(original).toMatchObject({
    nodeId: 3,
    heading: "Episode 1 · Pilot · Original",
    overview: "The body is found.",
    runtime: "1:30:09",
    still: "https://image.tmdb.org/t/p/w300/pilot.jpg",
  });
  expect(alternate).toMatchObject({
    nodeId: 4,
    heading: "Episode 1 · Pilot · Alternate",
    overview: "The body is found.",
    runtime: "1:26:57",
    still: "https://image.tmdb.org/t/p/w300/pilot.jpg",
  });
  expect(original?.playback).toMatchObject({
    nodeId: 3,
    seriesId: 4,
    title: "Episode 1 · Pilot · Original",
    subtitle: "Twin Peaks  ·  Season 1  ·  1:30:09",
    url: "/api/stream/tv/4/nodes/3/master.m3u8",
  });
  expect(content.seasons[0]?.episodes[2]).toMatchObject({
    nodeId: 5,
    heading: "Episode 2",
    overview: "The investigation spreads.",
    runtime: "44:31",
  });
});

function episodeRows() {
  return listSeriesContent("Twin Peaks", twinPeaks, 4).seasons.flatMap((season) => season.episodes);
}

test("starts an unwatched series at the first episode", () => {
  expect(seriesPlayTarget(episodeRows(), [])).toMatchObject({
    label: "Play now",
    playback: { nodeId: 3 },
  });
  expect(seriesPlayTarget(episodeRows(), [])?.progress).toBeUndefined();
});

test("continues the newest episode that is still in progress", () => {
  expect(
    seriesPlayTarget(episodeRows(), [
      { nodeId: 5, seriesId: 4, progress: 20 },
      { nodeId: 3, seriesId: 4, progress: 40 },
    ]),
  ).toMatchObject({
    label: "Continue",
    progress: 20,
    runtime: "44:31",
    playback: { nodeId: 5 },
  });
});

test("plays the next episode after a finished one and skips its other cuts", () => {
  expect(
    seriesPlayTarget(episodeRows(), [{ nodeId: 4, seriesId: 4, progress: 100 }]),
  ).toMatchObject({
    label: "Next episode",
    playback: { nodeId: 5, title: "Episode 2" },
  });
  expect(
    seriesPlayTarget(episodeRows(), [{ nodeId: 4, seriesId: 4, progress: 100 }])?.progress,
  ).toBeUndefined();
  expect(
    seriesPlayTarget(episodeRows(), [
      { nodeId: 4, seriesId: 4, progress: 40 },
      { nodeId: 3, seriesId: 4, progress: 100 },
    ]),
  ).toMatchObject({
    label: "Next episode",
    playback: { nodeId: 5 },
  });
});

test("starts over once every episode is finished", () => {
  expect(
    seriesPlayTarget(episodeRows(), [
      { nodeId: 3, seriesId: 4, progress: 100 },
      { nodeId: 5, seriesId: 4, progress: 95 },
    ]),
  ).toMatchObject({
    label: "Play now",
    playback: { nodeId: 3 },
  });
});

test("plays the next episode and skips other cuts of the one that just finished", () => {
  expect(nextEpisodePlayback("Twin Peaks", twinPeaks, 4, 3)).toMatchObject({
    nodeId: 5,
    title: "Episode 2",
  });
  expect(nextEpisodePlayback("Twin Peaks", twinPeaks, 4, 4)).toMatchObject({
    nodeId: 5,
    title: "Episode 2",
  });
  expect(nextEpisodePlayback("Twin Peaks", twinPeaks, 4, 5)).toBeNull();
  expect(nextEpisodePlayback("Twin Peaks", twinPeaks, 4, 10)).toBeNull();
});

test("keeps season extras inside that season and series extras after the seasons", () => {
  const content = listSeriesContent("Twin Peaks", twinPeaks, 4);

  expect(content.seasons[0]?.extras).toEqual([]);
  expect(content.seasons[1]?.extras).toMatchObject([
    {
      title: "Deleted Scenes",
      playback: {
        subtitle: "Twin Peaks · Season 2 extra · 1:00",
      },
    },
  ]);
  expect(content.extras.map((extra) => extra.title)).toEqual([
    "A Slice of Lynch",
    "Secrets From Another Place",
  ]);
  expect(content.extras[1]?.children[0]).toMatchObject({
    title: "Creating Season One",
    playback: { subtitle: "Twin Peaks extra · 30:38" },
  });
  expect(content.seasons[1]?.extras[0]?.title).not.toBe("A Slice of Lynch");
});

test("maps a series card from seasons and episodes instead of a runtime", () => {
  const series: SeriesSummary = {
    id: 4,
    title: "Twin Peaks",
    originalTitle: "Twin Peaks",
    overview: "A town full of secrets.",
    posterPath: "/poster.jpg",
    backdropPath: "/backdrop.jpg",
    releaseDate: "1990-04-08",
    year: 1990,
    tagline: null,
    seasonCount: 1,
    episodeCount: 8,
    genres: [
      { id: 18, name: "Drama" },
      { id: 2, name: null },
    ],
  };

  expect(mapSeriesToMedia(series)).toMatchObject({
    id: 4,
    type: "tv",
    title: "Twin Peaks",
    year: "1990",
    meta: "1 season  ·  8 episodes",
    episodeCount: 8,
    description: "A town full of secrets.",
    url: "",
    image: "https://image.tmdb.org/t/p/w500/poster.jpg",
    genres: [{ id: 18, name: "Drama" }],
  });
});
