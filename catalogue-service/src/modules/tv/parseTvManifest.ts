/**
 * Parse a TV-series manifest into a tree.
 *
 * A manifest identifies the series with DVD.Title and DVD.Year. Seasons hold
 * episodes and, optionally, extras. An episode is one file, or a parent of
 * several versions (Original, Alternate, ...) that each have a file. Extras
 * can belong to the whole series or to one season, and a group of extras can
 * contain further groups. A value with File is playable and is not walked
 * any deeper. A value without File is a parent of its sibling children.
 */

import path from "node:path";
import type { TvSeasonEpisodeDetails } from "../tmdb/tmdbClientService.js";

export type TvNodeKind =
  | "season"
  | "episode"
  | "version"
  | "extras"
  | "group"
  | "media";

export interface ParsedTvNode {
  kind: TvNodeKind;
  /** JSON object key, kept even when it is only a number. */
  label: string;
  /**
   * Explicit Title, or a descriptive extra/version label.
   * Numbered episodes stay null so TMDB can fill the episode name later.
   */
  title: string | null;
  runtime: string | null;
  /** Absolute media path. Null when this node only groups children. */
  filePath: string | null;
  /** Identity that stays put when the same manifest is imported again. */
  stableKey: string;
  sortOrder: number;
  seasonNumber: number | null;
  episodeNumber: number | null;
  /** TMDB episode overview. Manifests do not carry this. */
  overview?: string | null;
  /** TMDB still path, the same shape as a poster path. */
  stillPath?: string | null;
  children: ParsedTvNode[];
}

export interface ParsedTvSeries {
  title: string;
  year?: number;
  hasExtras: boolean;
  nodes: ParsedTvNode[];
}

const LEAF_KEYS = new Set(["Title", "Runtime", "File"]);

export function parseTvManifest(
  metadata: unknown,
  libraryRoot: string,
): ParsedTvSeries | null {
  if (!isRecord(metadata)) {
    return null;
  }

  const dvd = metadata["DVD"];
  if (!isRecord(dvd)) {
    return null;
  }

  const title = readText(dvd["Title"]);
  if (!title || title.length < 2) {
    return null;
  }

  const seasons = metadata["Seasons"];
  if (!isRecord(seasons)) {
    return null;
  }

  const nodes: ParsedTvNode[] = [];
  for (const [key, value] of Object.entries(seasons)) {
    if (isNamed(key, "extras") || !isRecord(value)) {
      continue;
    }

    const season = parseSeason(key, value, libraryRoot);
    if (season) {
      season.sortOrder = nodes.length;
      nodes.push(season);
    }
  }

  const seriesExtras = findRecord(seasons, "extras");
  if (seriesExtras) {
    const extras = parseContainer(
      seriesExtras.key,
      seriesExtras.value,
      "extras",
      "seasons",
      libraryRoot,
      null,
      null,
    );
    if (extras) {
      extras.sortOrder = nodes.length;
      nodes.push(extras);
    }
  }

  const rootExtras = findRecord(metadata, "extras");
  if (rootExtras) {
    const extras = parseContainer(
      rootExtras.key,
      rootExtras.value,
      "extras",
      "root",
      libraryRoot,
      null,
      null,
    );
    if (extras) {
      extras.sortOrder = nodes.length;
      nodes.push(extras);
    }
  }

  if (!hasPlayable(nodes)) {
    return null;
  }

  const parsed: ParsedTvSeries = {
    title,
    hasExtras: hasKind(nodes, "extras"),
    nodes,
  };
  const year = dvd["Year"];
  if (typeof year === "number" && Number.isFinite(year)) {
    parsed.year = year;
  }

  return parsed;
}

/** Season numbers present in the manifest, in first-seen order. */
export function manifestSeasonNumbers(nodes: ParsedTvNode[]): number[] {
  const seasons: number[] = [];
  const seen = new Set<number>();
  const walk = (list: ParsedTvNode[]): void => {
    for (const node of list) {
      if (
        node.kind === "season" &&
        node.seasonNumber != null &&
        !seen.has(node.seasonNumber)
      ) {
        seen.add(node.seasonNumber);
        seasons.push(node.seasonNumber);
      }
      walk(node.children);
    }
  };
  walk(nodes);
  return seasons;
}

/**
 * Fill episode titles from TMDB season data. Manifest titles and version
 * labels are left as they are.
 */
export function applyEpisodeTitles(
  nodes: ParsedTvNode[],
  seasonNumber: number,
  titles: Record<number, string>,
): void {
  const walk = (list: ParsedTvNode[]): void => {
    for (const node of list) {
      if (
        node.kind === "episode" &&
        node.seasonNumber === seasonNumber &&
        node.episodeNumber != null &&
        !node.title
      ) {
        const name = titles[node.episodeNumber];
        if (name) {
          node.title = name;
        }
      }
      walk(node.children);
    }
  };
  walk(nodes);
}

/**
 * Copy season-details fields onto matching episodes.
 * A manifest title or runtime wins. Version labels are left alone.
 * Runtime is only filled for a single-file episode; a multi-version
 * episode keeps each cut's own duration.
 */
export function applyTvSeasonDetails(
  nodes: ParsedTvNode[],
  seasonNumber: number,
  episodes: TvSeasonEpisodeDetails[],
): void {
  const byNumber = new Map(
    episodes.map((episode) => [episode.episodeNumber, episode]),
  );
  const walk = (list: ParsedTvNode[]): void => {
    for (const node of list) {
      if (
        node.kind === "episode" &&
        node.seasonNumber === seasonNumber &&
        node.episodeNumber != null
      ) {
        const episode = byNumber.get(node.episodeNumber);
        if (episode) {
          if (!node.title && episode.name) {
            node.title = episode.name;
          }
          if (!node.overview && episode.overview) {
            node.overview = episode.overview;
          }
          if (!node.stillPath && episode.stillPath) {
            node.stillPath = episode.stillPath;
          }
          if (!node.runtime && node.filePath && episode.runtimeMinutes) {
            node.runtime = formatTmdbRuntime(episode.runtimeMinutes);
          }
        }
      }
      walk(node.children);
    }
  };
  walk(nodes);
}

/** 95 -> "1:35:00", 47 -> "47:00". Seconds are unknown from TMDB. */
export function formatTmdbRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) {
    return `${remaining}:00`;
  }
  return `${hours}:${String(remaining).padStart(2, "0")}:00`;
}

function parseSeason(
  label: string,
  value: Record<string, unknown>,
  libraryRoot: string,
): ParsedTvNode | null {
  const seasonNumber = parseSeasonNumber(label);
  const stableKey = childKey("seasons", "season", label);
  const children: ParsedTvNode[] = [];

  const episodes = findRecord(value, "episodes");
  if (episodes) {
    appendEpisodes(
      children,
      episodes.value,
      stableKey,
      libraryRoot,
      seasonNumber,
    );
  }

  for (const [key, child] of Object.entries(value)) {
    if (isNamed(key, "episodes") || isNamed(key, "extras") || !isRecord(child)) {
      continue;
    }
    const episode = parseEpisode(
      key,
      child,
      stableKey,
      libraryRoot,
      seasonNumber,
    );
    if (episode) {
      episode.sortOrder = children.length;
      children.push(episode);
    }
  }

  const extras = findRecord(value, "extras");
  if (extras) {
    const extrasNode = parseContainer(
      extras.key,
      extras.value,
      "extras",
      stableKey,
      libraryRoot,
      seasonNumber,
      null,
    );
    if (extrasNode) {
      extrasNode.sortOrder = children.length;
      children.push(extrasNode);
    }
  }

  if (children.length === 0) {
    return null;
  }

  return {
    kind: "season",
    label,
    title: null,
    runtime: null,
    filePath: null,
    stableKey,
    sortOrder: 0,
    seasonNumber,
    episodeNumber: null,
    children,
  };
}

function appendEpisodes(
  children: ParsedTvNode[],
  episodes: Record<string, unknown>,
  seasonKey: string,
  libraryRoot: string,
  seasonNumber: number | null,
): void {
  for (const [key, child] of Object.entries(episodes)) {
    if (LEAF_KEYS.has(key) || !isRecord(child)) {
      continue;
    }
    const episode = parseEpisode(
      key,
      child,
      seasonKey,
      libraryRoot,
      seasonNumber,
    );
    if (episode) {
      episode.sortOrder = children.length;
      children.push(episode);
    }
  }
}

function parseEpisode(
  label: string,
  value: Record<string, unknown>,
  parentKey: string,
  libraryRoot: string,
  seasonNumber: number | null,
): ParsedTvNode | null {
  const episodeNumber = parseEpisodeNumber(label);
  const stableKey = childKey(parentKey, "episode", label);
  const explicit = readText(value["Title"]);
  const file = readText(value["File"]);

  if (file) {
    return {
      kind: "episode",
      label,
      title: explicit,
      runtime: readRuntime(value["Runtime"]),
      filePath: resolveStoragePath(libraryRoot, file),
      stableKey,
      sortOrder: 0,
      seasonNumber,
      episodeNumber,
      children: [],
    };
  }

  const children: ParsedTvNode[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (LEAF_KEYS.has(key) || !isRecord(child)) {
      continue;
    }

    const childFile = readText(child["File"]);
    if (childFile) {
      const version: ParsedTvNode = {
        kind: "version",
        label: key,
        title: displayTitle("version", key, readText(child["Title"])),
        runtime: readRuntime(child["Runtime"]),
        filePath: resolveStoragePath(libraryRoot, childFile),
        stableKey: childKey(stableKey, "version", key),
        sortOrder: children.length,
        seasonNumber,
        episodeNumber,
        children: [],
      };
      children.push(version);
      continue;
    }

    const group = parseContainer(
      key,
      child,
      "group",
      stableKey,
      libraryRoot,
      seasonNumber,
      episodeNumber,
    );
    if (group) {
      group.sortOrder = children.length;
      children.push(group);
    }
  }

  if (children.length === 0) {
    return null;
  }

  return {
    kind: "episode",
    label,
    title: explicit,
    runtime: null,
    filePath: null,
    stableKey,
    sortOrder: 0,
    seasonNumber,
    episodeNumber,
    children,
  };
}

function parseContainer(
  label: string,
  value: Record<string, unknown>,
  kind: "extras" | "group",
  parentKey: string,
  libraryRoot: string,
  seasonNumber: number | null,
  episodeNumber: number | null,
): ParsedTvNode | null {
  const stableKey = childKey(parentKey, kind, label);
  const children: ParsedTvNode[] = [];

  for (const [key, child] of Object.entries(value)) {
    if (LEAF_KEYS.has(key) || !isRecord(child)) {
      continue;
    }

    const childFile = readText(child["File"]);
    if (childFile) {
      children.push({
        kind: "media",
        label: key,
        title: displayTitle("media", key, readText(child["Title"])),
        runtime: readRuntime(child["Runtime"]),
        filePath: resolveStoragePath(libraryRoot, childFile),
        stableKey: childKey(stableKey, "media", key),
        sortOrder: children.length,
        seasonNumber,
        episodeNumber,
        children: [],
      });
      continue;
    }

    const nested = parseContainer(
      key,
      child,
      "group",
      stableKey,
      libraryRoot,
      seasonNumber,
      episodeNumber,
    );
    if (nested) {
      nested.sortOrder = children.length;
      children.push(nested);
    }
  }

  if (children.length === 0) {
    return null;
  }

  return {
    kind,
    label,
    title: displayTitle(kind, label, readText(value["Title"])),
    runtime: null,
    filePath: null,
    stableKey,
    sortOrder: 0,
    seasonNumber,
    episodeNumber,
    children,
  };
}

function displayTitle(
  kind: TvNodeKind,
  label: string,
  explicit: string | null,
): string | null {
  if (explicit) {
    return explicit;
  }
  if (kind === "season" || kind === "episode" || kind === "extras") {
    return null;
  }
  if (/^\d+$/.test(label.trim())) {
    return null;
  }
  return label;
}

function parseSeasonNumber(label: string): number | null {
  return parseNumberedLabel(label, /^(?:season|s)\s*0*(\d+)\b/i);
}

function parseEpisodeNumber(label: string): number | null {
  return parseNumberedLabel(label, /^(?:episode|ep)\.?\s*0*(\d+)\b/i);
}

function parseNumberedLabel(label: string, named: RegExp): number | null {
  const trimmed = label.trim();
  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed);
  }
  const match = trimmed.match(named);
  if (!match?.[1]) {
    return null;
  }
  return Number(match[1]);
}

function childKey(parentKey: string, kind: string, label: string): string {
  return `${parentKey}/${kind}:${encodeURIComponent(label)}`;
}

function resolveStoragePath(libraryRoot: string, fileFromJson: string): string {
  const normalizedRelative = fileFromJson.replace(/\\/g, "/");
  return path.resolve(libraryRoot, normalizedRelative).replace(/\\/g, "/");
}

function findRecord(
  value: Record<string, unknown>,
  name: string,
): { key: string; value: Record<string, unknown> } | null {
  for (const [key, child] of Object.entries(value)) {
    if (isNamed(key, name) && isRecord(child)) {
      return { key, value: child };
    }
  }
  return null;
}

function isNamed(key: string, name: string): boolean {
  return key.toLowerCase() === name;
}

function readText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readRuntime(value: unknown): string | null {
  if (typeof value === "string") {
    return readText(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasPlayable(nodes: ParsedTvNode[]): boolean {
  return nodes.some(
    (node) => node.filePath != null || hasPlayable(node.children),
  );
}

function hasKind(nodes: ParsedTvNode[], kind: TvNodeKind): boolean {
  return nodes.some(
    (node) => node.kind === kind || hasKind(node.children, kind),
  );
}
