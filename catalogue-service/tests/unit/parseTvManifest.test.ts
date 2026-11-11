import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyEpisodeTitles,
  applyTvSeasonDetails,
  parseTvManifest,
  type ParsedTvNode,
} from "../../src/modules/tv/parseTvManifest.js";

const examplesDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../examples",
);

function storagePath(libraryRoot: string, fileFromJson: string): string {
  const normalizedRelative = fileFromJson.replace(/\\/g, "/");
  return path.resolve(libraryRoot, normalizedRelative).replace(/\\/g, "/");
}

function findByLabel(
  nodes: ParsedTvNode[],
  label: string,
): ParsedTvNode | undefined {
  for (const node of nodes) {
    if (node.label === label) {
      return node;
    }
    const nested = findByLabel(node.children, label);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

function countFiles(value: unknown): number {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return 0;
  }
  const record = value as Record<string, unknown>;
  const file = record["File"];
  let count = typeof file === "string" && file.trim().length > 0 ? 1 : 0;
  for (const [key, child] of Object.entries(record)) {
    if (key === "File" || key === "Title" || key === "Runtime") {
      continue;
    }
    count += countFiles(child);
  }
  return count;
}

function countPlayable(nodes: ParsedTvNode[]): number {
  return nodes.reduce(
    (sum, node) => sum + (node.filePath ? 1 : 0) + countPlayable(node.children),
    0,
  );
}

describe("parseTvManifest", () => {
  const libraryRoot = "C:/Media/TV";

  it("rejects a movie manifest", () => {
    expect(
      parseTvManifest(
        {
          DVD: {
            Title: "Big Fish",
            Year: 2003,
            File: "Big Fish\\big-fish.mp4",
          },
        },
        libraryRoot,
      ),
    ).toBeNull();
  });

  it("reads single-file episodes from a season", () => {
    const raw = JSON.parse(
      readFileSync(path.join(examplesDir, "northern-exposure.json"), "utf8"),
    ) as unknown;
    const parsed = parseTvManifest(raw, libraryRoot);

    expect(parsed?.title).toBe("Northern Exposure");
    expect(parsed?.year).toBe(1990);
    expect(parsed?.hasExtras).toBe(false);
    expect(parsed?.nodes).toHaveLength(1);

    const season = parsed?.nodes[0];
    expect(season).toMatchObject({
      kind: "season",
      label: "1",
      seasonNumber: 1,
      stableKey: "seasons/season:1",
    });
    expect(season?.children).toHaveLength(8);

    const first = season?.children[0];
    expect(first).toMatchObject({
      kind: "episode",
      label: "Episode 1",
      title: null,
      episodeNumber: 1,
      seasonNumber: 1,
      stableKey: "seasons/season:1/episode:Episode%201",
      filePath: storagePath(
        libraryRoot,
        "Northern Exposure\\northern-exposure-s1e1.mp4",
      ),
    });
    expect(countPlayable(parsed?.nodes ?? [])).toBe(countFiles(raw));
  });

  it("keeps episode versions, season extras, and nested series extras", () => {
    const raw = JSON.parse(
      readFileSync(path.join(examplesDir, "twin-peaks.json"), "utf8"),
    ) as unknown;
    const parsed = parseTvManifest(raw, libraryRoot);

    expect(parsed?.title).toBe("Twin Peaks");
    expect(parsed?.year).toBe(1990);
    expect(parsed?.hasExtras).toBe(true);
    expect(parsed?.nodes.map((node) => node.kind)).toEqual([
      "season",
      "season",
      "extras",
    ]);

    const seasonOne = parsed?.nodes[0];
    const pilot = seasonOne?.children[0];
    expect(pilot).toMatchObject({
      kind: "episode",
      label: "1",
      title: null,
      episodeNumber: 1,
      filePath: null,
      stableKey: "seasons/season:1/episode:1",
    });
    expect(pilot?.children.map((child) => child.label)).toEqual([
      "Original",
      "Alternate",
    ]);
    expect(pilot?.children[0]).toMatchObject({
      kind: "version",
      title: "Original",
      runtime: "1:30:09",
      episodeNumber: 1,
      stableKey: "seasons/season:1/episode:1/version:Original",
      filePath: storagePath(
        libraryRoot,
        "Twin Peaks\\s1\\twin-peaks-s1e1-the-pilot-original-version\\master.m3u8",
      ),
    });
    expect(pilot?.children[1]?.runtime).toBe("1:26:57");

    const second = seasonOne?.children[1];
    expect(second).toMatchObject({
      kind: "episode",
      label: "2",
      title: null,
      episodeNumber: 2,
      runtime: "44:31",
      children: [],
    });
    expect(second?.filePath).toContain("twin-peaks-s1e2");

    const seasonTwo = parsed?.nodes[1];
    const seasonExtras = seasonTwo?.children.find((node) => node.kind === "extras");
    expect(seasonExtras?.children.map((node) => node.title)).toEqual([
      "Deleted Scenes",
      "Production Documents",
    ]);
    expect(seasonExtras?.children[0]).toMatchObject({
      kind: "media",
      label: "1",
      runtime: "1:00",
    });

    const seriesExtras = parsed?.nodes[2];
    expect(seriesExtras?.stableKey).toBe("seasons/extras:Extras");
    const secrets = findByLabel(
      seriesExtras?.children ?? [],
      "2: Secrets From Another Place: Creating Twin Peaks",
    );
    expect(secrets?.kind).toBe("group");
    expect(secrets?.title).toBe(
      "2: Secrets From Another Place: Creating Twin Peaks",
    );
    expect(secrets?.children.map((child) => child.title)).toEqual([
      "Freshly Squeezed: Creating Season One",
      "Into the Night: Creating Season Two",
    ]);
    expect(secrets?.children[0]).toMatchObject({
      kind: "media",
      runtime: "30:38",
    });

    const townSign = findByLabel(seriesExtras?.children ?? [], "Town Sign");
    expect(townSign).toMatchObject({
      kind: "media",
      title: "Town Sign",
      runtime: "0:35",
    });
    expect(townSign?.filePath).toBe(
      storagePath(
        libraryRoot,
        "Twin Peaks\\extras\\festival-map-town-sign.mp4",
      ),
    );
    expect(countPlayable(parsed?.nodes ?? [])).toBe(countFiles(raw));
  });

  it("keeps an explicit episode title and still nests its versions", () => {
    const parsed = parseTvManifest(
      {
        DVD: { Title: "Example", Year: 2000 },
        Seasons: {
          "1": {
            Episodes: {
              "1": {
                Title: "Pilot",
                Original: { File: "show\\original.mp4", Runtime: "40:00" },
                Alternate: { File: "show\\alternate.mp4", Runtime: "42:00" },
              },
            },
          },
        },
        Extras: {
          Interviews: {
            File: "show\\interviews.mp4",
            Runtime: "10:00",
          },
        },
      },
      libraryRoot,
    );

    expect(parsed?.nodes[0]?.children[0]).toMatchObject({
      title: "Pilot",
      filePath: null,
    });
    expect(parsed?.nodes[0]?.children[0]?.children).toHaveLength(2);
    expect(parsed?.nodes[1]).toMatchObject({
      kind: "extras",
      stableKey: "root/extras:Extras",
    });
    expect(parsed?.nodes[1]?.children[0]?.title).toBe("Interviews");
    expect(parsed?.hasExtras).toBe(true);
  });

  it("fills only untitled episode names from TMDB", () => {
    const parsed = parseTvManifest(
      {
        DVD: { Title: "Example", Year: 2000 },
        Seasons: {
          "1": {
            Episodes: {
              "1": {
                Original: { File: "show\\original.mp4" },
                Alternate: { File: "show\\alternate.mp4" },
              },
              "2": { Title: "Kept", File: "show\\e2.mp4" },
            },
          },
        },
      },
      libraryRoot,
    );
    const nodes = parsed?.nodes ?? [];

    applyEpisodeTitles(nodes, 1, {
      1: "Northwest Passage",
      2: "Should Not Replace",
    });

    expect(nodes[0]?.children[0]?.title).toBe("Northwest Passage");
    expect(nodes[0]?.children[0]?.children[0]?.title).toBe("Original");
    expect(nodes[0]?.children[1]?.title).toBe("Kept");
  });

  it("copies season overview, still, and runtime without replacing a cut", () => {
    const parsed = parseTvManifest(
      {
        DVD: { Title: "Example", Year: 2000 },
        Seasons: {
          "1": {
            Episodes: {
              "1": {
                Original: { File: "show\\original.mp4", Runtime: "1:30:09" },
                Alternate: { File: "show\\alternate.mp4", Runtime: "1:26:57" },
              },
              "2": { File: "show\\e2.mp4" },
              "3": { Title: "Kept", File: "show\\e3.mp4", Runtime: "46:00" },
            },
          },
        },
      },
      libraryRoot,
    );
    const nodes = parsed?.nodes ?? [];

    applyTvSeasonDetails(nodes, 1, [
      {
        episodeNumber: 1,
        name: "Pilot",
        overview: "The body is found.",
        runtimeMinutes: 95,
        stillPath: "/pilot.jpg",
      },
      {
        episodeNumber: 2,
        name: "Traces to Nowhere",
        overview: "The investigation spreads.",
        runtimeMinutes: 47,
        stillPath: "/e2.jpg",
      },
      {
        episodeNumber: 3,
        name: "Should Not Replace",
        overview: "Unused.",
        runtimeMinutes: 47,
        stillPath: null,
      },
    ]);

    const pilot = nodes[0]?.children[0];
    expect(pilot?.title).toBe("Pilot");
    expect(pilot?.overview).toBe("The body is found.");
    expect(pilot?.stillPath).toBe("/pilot.jpg");
    expect(pilot?.runtime).toBeNull();
    expect(pilot?.children[0]?.runtime).toBe("1:30:09");
    expect(pilot?.children[0]?.title).toBe("Original");

    const second = nodes[0]?.children[1];
    expect(second?.title).toBe("Traces to Nowhere");
    expect(second?.runtime).toBe("47:00");
    expect(second?.stillPath).toBe("/e2.jpg");

    const third = nodes[0]?.children[2];
    expect(third?.title).toBe("Kept");
    expect(third?.runtime).toBe("46:00");
    expect(third?.overview).toBe("Unused.");
  });
});
