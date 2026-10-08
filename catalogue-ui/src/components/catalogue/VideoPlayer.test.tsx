import type { ReactNode } from "react";
import { ThemeProvider } from "@mui/material/styles";
import { beforeEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { createAppTheme } from "@/lib/theme";
import { useWatchProgressStore } from "@/stores/useWatchProgressStore";
import { VideoPlayer } from "./VideoPlayer";

const { queueMoviePlaybackProgressUpdate, hlsControl } = vi.hoisted(() => ({
  queueMoviePlaybackProgressUpdate: vi.fn(() => Promise.resolve()),
  hlsControl: {
    tracks: [] as { name: string }[],
    instances: [] as { audioTrack: number }[],
  },
}));

vi.mock("@/api/playback", () => ({
  queueMoviePlaybackProgressUpdate,
}));

vi.mock("hls.js", () => {
  class FakeHls {
    static Events = {
      AUDIO_TRACKS_UPDATED: "hlsAudioTracksUpdated",
      AUDIO_TRACK_SWITCHED: "hlsAudioTrackSwitched",
    };

    static isSupported() {
      return true;
    }

    audioTracks: { name: string }[];
    audioTrack = 0;

    constructor() {
      this.audioTracks = hlsControl.tracks.map((track) => ({ ...track }));
      hlsControl.instances.push(this);
    }

    loadSource() {}

    attachMedia() {}

    destroy() {}

    on() {}

    off() {}
  }

  return { default: FakeHls };
});

const theme = createAppTheme();

function ThemeWrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
}

function videoElement(screen: Awaited<ReturnType<typeof render>>) {
  const video = screen.container.querySelector("video");
  if (!(video instanceof HTMLVideoElement)) {
    throw new Error("Video element was not rendered");
  }

  return video;
}

function stubTimeline(video: HTMLVideoElement, duration: number, currentTime = 0) {
  let time = currentTime;
  Object.defineProperty(video, "duration", {
    configurable: true,
    get: () => duration,
  });
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    get: () => time,
    set: (value: number) => {
      time = value;
    },
  });

  return () => time;
}

beforeEach(() => {
  hlsControl.tracks = [];
  hlsControl.instances = [];
  queueMoviePlaybackProgressUpdate.mockClear();
  useWatchProgressStore.setState({ progressById: {}, hydratedFor: null });
});

test("renders a video for a file url", async () => {
  const screen = await render(<VideoPlayer src="/clip.mp4" />, {
    wrapper: ThemeWrapper,
  });

  const video = videoElement(screen);
  await expect.poll(() => video.src).toContain("/clip.mp4");
  expect(video.controls).toBe(true);
  await expect.element(screen.getByText("Audio")).not.toBeInTheDocument();
});

test("hides the audio menu when the stream has one track", async () => {
  hlsControl.tracks = [{ name: "English" }];
  const screen = await render(<VideoPlayer src="/movie.m3u8" />, {
    wrapper: ThemeWrapper,
  });

  await expect.poll(() => hlsControl.instances.length).toBeGreaterThan(0);
  await expect.element(screen.getByText("Audio")).not.toBeInTheDocument();
});

test("switches the audio track", async () => {
  hlsControl.tracks = [{ name: "English" }, { name: "French" }];
  const screen = await render(<VideoPlayer src="/movie.m3u8" />, {
    wrapper: ThemeWrapper,
  });

  const player = hlsControl.instances.at(-1);
  const audioTrack = screen.getByRole("combobox");
  await expect.element(audioTrack).toHaveTextContent("English");

  await audioTrack.click();
  await screen.getByRole("option", { name: "French" }).click();

  await expect.element(audioTrack).toHaveTextContent("French");
  expect(player?.audioTrack).toBe(1);
});

test("resumes from saved progress", async () => {
  useWatchProgressStore.setState({ progressById: { 7: 40 }, hydratedFor: "ada" });
  const screen = await render(
    <VideoPlayer src="/clip.mp4" mediaId={7} playbackUser="ada" />,
    { wrapper: ThemeWrapper },
  );

  const currentTime = stubTimeline(videoElement(screen), 100);
  videoElement(screen).dispatchEvent(new Event("loadedmetadata"));

  await expect.poll(currentTime).toBe(40);
  expect(queueMoviePlaybackProgressUpdate).not.toHaveBeenCalled();
});

test("reports progress while watching", async () => {
  const screen = await render(
    <VideoPlayer src="/clip.mp4" mediaId={7} playbackUser="ada" />,
    { wrapper: ThemeWrapper },
  );

  stubTimeline(videoElement(screen), 200, 50);
  videoElement(screen).dispatchEvent(new Event("timeupdate"));

  await expect.poll(() => useWatchProgressStore.getState().progressById[7]).toBe(25);
  expect(queueMoviePlaybackProgressUpdate).toHaveBeenCalledWith("ada", 7, 25);
});

test("does not report progress without a playback user", async () => {
  const screen = await render(<VideoPlayer src="/clip.mp4" mediaId={7} />, {
    wrapper: ThemeWrapper,
  });

  stubTimeline(videoElement(screen), 200, 50);
  videoElement(screen).dispatchEvent(new Event("timeupdate"));

  expect(queueMoviePlaybackProgressUpdate).not.toHaveBeenCalled();
  expect(useWatchProgressStore.getState().progressById).toEqual({});
});
