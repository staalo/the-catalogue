import fs from "node:fs/promises";
import path from "node:path";
import type {
  MovieResponse,
  SubtitleTrackResponse,
} from "../../shared/movies/movieResponse.js";

const SIDECAR_VIDEO_EXTENSIONS = new Set([".mp4", ".webm"]);
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

/**
 * WebVTT files beside an .mp4 or .webm video, named `{basename}-{language}.vtt`.
 * Other containers are skipped: browsers that cannot play them cannot show the
 * tracks, and HLS playlists carry their own subtitles.
 */
export async function subtitlesForVideo(
  videoPath: string,
  streamUrlFor: (fileName: string) => string,
): Promise<SubtitleTrackResponse[]> {
  if (!isSidecarVideo(videoPath)) {
    return [];
  }

  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    stat = await fs.stat(videoPath);
  } catch {
    return [];
  }
  if (!stat.isFile()) {
    return [];
  }

  const extension = path.extname(videoPath);
  const baseName = path.basename(videoPath, extension);
  const prefix = `${baseName}-`.toLowerCase();
  const entries = await fs
    .readdir(path.dirname(videoPath), { withFileTypes: true })
    .catch(() => null);
  if (!entries) {
    return [];
  }

  const matches: Array<{ language: string; label: string; fileName: string }> = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const fileName = entry.name;
    const lowerName = fileName.toLowerCase();
    if (!lowerName.startsWith(prefix) || !lowerName.endsWith(".vtt")) {
      continue;
    }

    const language = normalizeLanguageTag(fileName.slice(prefix.length, -4));
    if (!language) {
      continue;
    }

    matches.push({
      language,
      label: languageLabel(language),
      fileName,
    });
  }

  matches.sort(
    (left, right) =>
      left.language.localeCompare(right.language) ||
      left.fileName.localeCompare(right.fileName),
  );

  const seen = new Set<string>();
  const tracks: SubtitleTrackResponse[] = [];
  for (const match of matches) {
    if (seen.has(match.language)) {
      continue;
    }
    seen.add(match.language);
    tracks.push({
      language: match.language,
      label: match.label,
      url: streamUrlFor(match.fileName),
    });
  }

  return tracks;
}

export async function attachMovieSubtitles(movies: MovieResponse[]): Promise<void> {
  await Promise.all(
    movies.map(async (movie) => {
      const [subtitles] = await Promise.all([
        subtitlesForVideo(
          movie.url,
          (fileName) => `stream/movies/${movie.id}/${fileName}`,
        ),
        Promise.all(
          movie.extras.map(async (extra) => {
            extra.subtitles = await subtitlesForVideo(
              extra.url,
              (fileName) =>
                `stream/movies/${movie.id}/extras/${extra.id}/${fileName}`,
            );
          }),
        ),
      ]);
      movie.subtitles = subtitles;
    }),
  );
}

export async function subtitlesByNodeId(
  seriesId: number,
  nodes: Array<{ id: number; url: string | null }>,
): Promise<Map<number, SubtitleTrackResponse[]>> {
  const pairs = await Promise.all(
    nodes.map(async (node) => {
      const subtitles = node.url
        ? await subtitlesForVideo(
            node.url,
            (fileName) => `stream/tv/${seriesId}/nodes/${node.id}/${fileName}`,
          )
        : [];
      return [node.id, subtitles] as const;
    }),
  );

  return new Map(pairs);
}

function isSidecarVideo(videoPath: string): boolean {
  return SIDECAR_VIDEO_EXTENSIONS.has(path.extname(videoPath).toLowerCase());
}

function normalizeLanguageTag(tag: string): string | null {
  const match = /^([a-zA-Z]{2,3})(?:-([a-zA-Z]{2}|\d{3}))?$/.exec(tag);
  if (!match?.[1]) {
    return null;
  }

  const primary = match[1].toLowerCase();
  const region = match[2];
  if (!region) {
    return primary;
  }

  return `${primary}-${/^\d+$/.test(region) ? region : region.toUpperCase()}`;
}

function languageLabel(tag: string): string {
  try {
    return languageNames.of(tag) ?? tag;
  } catch {
    return tag;
  }
}
