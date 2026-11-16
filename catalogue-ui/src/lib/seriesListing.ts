import { FINISHED_PROGRESS, isContinueWatching, type SeriesProgressEntry } from '@/lib/continueWatching';
import { catalogImage, mapSubtitleTracks, toStreamUrl } from '@/lib/media';
import type { SubtitleTrack, TvContentNode } from '@/types';

export type SeriesPlayback = {
  title: string;
  subtitle: string;
  url: string;
  subtitles: SubtitleTrack[];
  nodeId: number;
  seriesId: number;
};

/** One row in a season. A multi-version episode becomes one row per cut. */
export type EpisodeRow = {
  nodeId: number;
  /** Episode this cut belongs to. Every version of that episode shares it. */
  episodeId: number;
  heading: string;
  overview: string;
  still: string;
  runtime: string;
  playback: SeriesPlayback | null;
};

export type ExtraRow = {
  nodeId: number;
  title: string;
  runtime: string;
  playback: SeriesPlayback | null;
  children: ExtraRow[];
};

export type SeasonSection = {
  nodeId: number;
  heading: string;
  episodes: EpisodeRow[];
  extras: ExtraRow[];
};

export type SeriesContent = {
  seasons: SeasonSection[];
  extras: ExtraRow[];
};

/** The action under a series overview. Progress is set only while an episode is unfinished. */
export type SeriesPlayTarget = {
  label: 'Play now' | 'Continue' | 'Next episode';
  playback: SeriesPlayback;
  runtime: string;
  progress?: number;
};

const JOINER = '  ·  ';

/**
 * Versions do not carry their own synopsis. Every cut of an episode shows
 * the episode title, overview, and still, and keeps that cut's own runtime.
 */
export function listSeriesContent(
  seriesTitle: string,
  nodes: TvContentNode[],
  seriesId: number,
): SeriesContent {
  const seasons: SeasonSection[] = [];
  const seriesExtras: TvContentNode[] = [];

  for (const node of nodes) {
    if (node.kind === 'season') {
      seasons.push(toSeason(seriesTitle, seriesId, node));
    } else {
      seriesExtras.push(node);
    }
  }

  return {
    seasons,
    extras: flattenExtraRoots(seriesExtras, seriesTitle, seriesId, 'extra'),
  };
}

/**
 * The next episode after the one playing, in season order. Another cut of the
 * same episode is skipped. Extras do not continue into an episode.
 */
export function nextEpisodePlayback(
  seriesTitle: string,
  nodes: TvContentNode[],
  seriesId: number,
  currentNodeId: number,
): SeriesPlayback | null {
  const episodes = listSeriesContent(seriesTitle, nodes, seriesId).seasons.flatMap(
    (season) => season.episodes,
  );
  const currentIndex = episodes.findIndex((episode) => episode.nodeId === currentNodeId);
  if (currentIndex < 0) {
    return null;
  }

  const currentEpisodeId = episodes[currentIndex]?.episodeId;
  const next = episodes
    .slice(currentIndex + 1)
    .find((episode) => episode.episodeId !== currentEpisodeId && episode.playback);
  return next?.playback ?? null;
}

/**
 * Play now starts the first episode. Continue resumes the newest episode still
 * in progress. Next episode follows a finished episode when more remain.
 * A finished cut counts for the whole episode, so another version is skipped.
 */
export function seriesPlayTarget(
  episodes: EpisodeRow[],
  entries: SeriesProgressEntry[],
): SeriesPlayTarget | null {
  const playable = episodes.filter((episode) => episode.playback);
  const first = playable[0];
  if (!first?.playback) {
    return null;
  }

  const latest = new Map<number, number>();
  const newestFirst: number[] = [];
  for (const entry of entries) {
    if (latest.has(entry.nodeId)) {
      continue;
    }
    latest.set(entry.nodeId, entry.progress);
    newestFirst.push(entry.nodeId);
  }

  const finishedEpisodeIds = new Set<number>();
  for (const episode of playable) {
    const progress = latest.get(episode.nodeId);
    if (progress !== undefined && progress >= FINISHED_PROGRESS) {
      finishedEpisodeIds.add(episode.episodeId);
    }
  }

  const currentId = newestFirst.find((nodeId) => {
    const episode = playable.find((row) => row.nodeId === nodeId);
    return (
      episode !== undefined
      && !finishedEpisodeIds.has(episode.episodeId)
      && isContinueWatching(latest.get(nodeId))
    );
  });
  const current = playable.find((episode) => episode.nodeId === currentId);
  if (current?.playback) {
    return {
      label: 'Continue',
      playback: current.playback,
      runtime: current.runtime,
      progress: latest.get(current.nodeId),
    };
  }

  if (finishedEpisodeIds.size > 0) {
    const next = playable.find((episode) => !finishedEpisodeIds.has(episode.episodeId));
    if (next?.playback) {
      return { label: 'Next episode', playback: next.playback, runtime: next.runtime };
    }
  }

  return { label: 'Play now', playback: first.playback, runtime: first.runtime };
}

function toSeason(
  seriesTitle: string,
  seriesId: number,
  season: TvContentNode,
): SeasonSection {
  const heading = seasonHeading(season);
  const episodes: EpisodeRow[] = [];
  const extras: TvContentNode[] = [];

  for (const child of childNodes(season)) {
    if (child.kind === 'episode') {
      episodes.push(...expandEpisode(seriesTitle, seriesId, heading, child));
    } else {
      extras.push(child);
    }
  }

  return {
    nodeId: season.id,
    heading,
    episodes,
    extras: flattenExtraRoots(extras, seriesTitle, seriesId, `${heading} extra`),
  };
}

function expandEpisode(
  seriesTitle: string,
  seriesId: number,
  seasonHeadingText: string,
  episode: TvContentNode,
): EpisodeRow[] {
  const versions = childNodes(episode).filter((child) => child.kind === 'version');
  const cuts = versions.length > 0 ? versions : [episode];

  return cuts.map((cut) => {
    const versionName = cut === episode ? '' : cut.title?.trim() || cut.label;
    const heading = [episodeHeading(episode), versionName].filter(Boolean).join(' · ');
    const runtime = (cut === episode ? episode.runtime : cut.runtime)?.trim() ?? '';
    const url = toStreamUrl(cut.url ?? undefined);

    return {
      nodeId: cut.id,
      episodeId: episode.id,
      heading,
      overview: episode.overview?.trim() ?? '',
      still: catalogImage(episode.stillPath, 'w300'),
      runtime,
      playback: url
        ? {
            nodeId: cut.id,
            seriesId,
            title: heading,
            subtitle: [seriesTitle, seasonHeadingText, runtime].filter(Boolean).join(JOINER),
            url,
            subtitles: mapSubtitleTracks(cut.subtitles),
          }
        : null,
    };
  });
}

function episodeHeading(episode: TvContentNode): string {
  const number = episode.episodeNumber != null ? `Episode ${episode.episodeNumber}` : '';
  const title = episode.title?.trim() ?? '';
  if (number && title && title !== number) {
    return `${number} · ${title}`;
  }
  return title || number || episode.label;
}

function seasonHeading(season: TvContentNode): string {
  if (season.seasonNumber != null) {
    return `Season ${season.seasonNumber}`;
  }
  return season.title?.trim() || season.label;
}

function flattenExtraRoots(
  nodes: TvContentNode[],
  seriesTitle: string,
  seriesId: number,
  place: string,
): ExtraRow[] {
  const rows: ExtraRow[] = [];
  for (const node of nodes) {
    const title = (node.title?.trim() || node.label).trim().toLowerCase();
    if ((node.kind === 'extras' || node.kind === 'group') && !node.url && title === 'extras') {
      rows.push(...flattenExtraRoots(childNodes(node), seriesTitle, seriesId, place));
      continue;
    }
    const row = toExtra(node, seriesTitle, seriesId, place);
    if (row) {
      rows.push(row);
    }
  }
  return rows;
}

function toExtra(
  node: TvContentNode,
  seriesTitle: string,
  seriesId: number,
  place: string,
): ExtraRow | null {
  const children = childNodes(node)
    .map((child) => toExtra(child, seriesTitle, seriesId, place))
    .filter((child): child is ExtraRow => child !== null);
  const title = node.title?.trim() || node.label;
  const runtime = node.runtime?.trim() ?? '';
  const url = toStreamUrl(node.url ?? undefined);
  if (!url && children.length === 0) {
    return null;
  }

  const prefix = place === 'extra' ? `${seriesTitle} extra` : `${seriesTitle} · ${place}`;
  return {
    nodeId: node.id,
    title,
    runtime,
    playback: url
      ? {
          nodeId: node.id,
          seriesId,
          title,
          subtitle: runtime ? `${prefix} · ${runtime}` : prefix,
          url,
          subtitles: mapSubtitleTracks(node.subtitles),
        }
      : null,
    children,
  };
}

function childNodes(node: TvContentNode): TvContentNode[] {
  return Array.isArray(node.children) ? node.children : [];
}
