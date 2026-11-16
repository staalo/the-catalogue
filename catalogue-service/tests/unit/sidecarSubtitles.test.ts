import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MovieResponse } from "../../src/shared/movies/movieResponse.js";
import {
  attachMovieSubtitles,
  subtitlesByNodeId,
  subtitlesForVideo,
} from "../../src/modules/stream/sidecarSubtitles.js";

describe("sidecarSubtitles", () => {
  let directory: string;

  afterEach(async () => {
    if (directory) {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("lists language sidecars for an mp4 and ignores other files", async () => {
    directory = await mkdtemp(path.join(tmpdir(), "sidecar-mp4-"));
    const video = path.join(directory, "clip.mp4");
    await writeFile(video, "video");
    await writeFile(path.join(directory, "clip-fi.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "clip-en.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "clip-en-US.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "clip-notes.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "clip.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "other-en.vtt"), "WEBVTT");

    const tracks = await subtitlesForVideo(
      video,
      (fileName) => `stream/movies/12/${fileName}`,
    );

    expect(tracks).toEqual([
      {
        language: "en",
        label: "English",
        url: "stream/movies/12/clip-en.vtt",
      },
      {
        language: "en-US",
        label: "American English",
        url: "stream/movies/12/clip-en-US.vtt",
      },
      {
        language: "fi",
        label: "Finnish",
        url: "stream/movies/12/clip-fi.vtt",
      },
    ]);
  });

  it("lists sidecars for webm and skips mkv, avi, and hls", async () => {
    directory = await mkdtemp(path.join(tmpdir(), "sidecar-skip-"));
    await writeFile(path.join(directory, "clip.webm"), "video");
    await writeFile(path.join(directory, "clip-en.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "film.mkv"), "video");
    await writeFile(path.join(directory, "film-en.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "old.avi"), "video");
    await writeFile(path.join(directory, "old-fi.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "master.m3u8"), "#EXTM3U");
    await writeFile(path.join(directory, "master-en.vtt"), "WEBVTT");

    const streamUrl = (fileName: string) => fileName;
    expect(
      await subtitlesForVideo(path.join(directory, "clip.webm"), streamUrl),
    ).toEqual([{ language: "en", label: "English", url: "clip-en.vtt" }]);
    expect(
      await subtitlesForVideo(path.join(directory, "film.mkv"), streamUrl),
    ).toEqual([]);
    expect(
      await subtitlesForVideo(path.join(directory, "old.avi"), streamUrl),
    ).toEqual([]);
    expect(
      await subtitlesForVideo(path.join(directory, "master.m3u8"), streamUrl),
    ).toEqual([]);
  });

  it("attaches movie and extra tracks on the catalogue payload", async () => {
    directory = await mkdtemp(path.join(tmpdir(), "sidecar-movie-"));
    const moviePath = path.join(directory, "film.mp4");
    const extraPath = path.join(directory, "bonus.webm");
    await writeFile(moviePath, "video");
    await writeFile(extraPath, "video");
    await writeFile(path.join(directory, "film-en.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "film-fi.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "bonus-fi.vtt"), "WEBVTT");

    const movie = {
      id: 12,
      url: moviePath,
      subtitles: [],
      extras: [
        {
          id: 3,
          title: "Bonus",
          runtime: "1:00",
          url: extraPath,
          subtitles: [],
        },
      ],
    } as MovieResponse;

    await attachMovieSubtitles([movie]);

    expect(movie.subtitles).toEqual([
      {
        language: "en",
        label: "English",
        url: "stream/movies/12/film-en.vtt",
      },
      {
        language: "fi",
        label: "Finnish",
        url: "stream/movies/12/film-fi.vtt",
      },
    ]);
    expect(movie.extras[0]?.subtitles).toEqual([
      {
        language: "fi",
        label: "Finnish",
        url: "stream/movies/12/extras/3/bonus-fi.vtt",
      },
    ]);
  });

  it("attaches episode tracks and leaves an hls node empty", async () => {
    directory = await mkdtemp(path.join(tmpdir(), "sidecar-tv-"));
    const episode = path.join(directory, "episode.mp4");
    const playlist = path.join(directory, "master.m3u8");
    await writeFile(episode, "video");
    await writeFile(playlist, "#EXTM3U");
    await writeFile(path.join(directory, "episode-en.vtt"), "WEBVTT");
    await writeFile(path.join(directory, "master-en.vtt"), "WEBVTT");

    const tracks = await subtitlesByNodeId(4, [
      { id: 8, url: episode },
      { id: 9, url: playlist },
      { id: 10, url: null },
    ]);

    expect(tracks.get(8)).toEqual([
      {
        language: "en",
        label: "English",
        url: "stream/tv/4/nodes/8/episode-en.vtt",
      },
    ]);
    expect(tracks.get(9)).toEqual([]);
    expect(tracks.get(10)).toEqual([]);
  });
});
