import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const previousDatabaseUrl = process.env["DATABASE_URL"];
let tempDir = "";

type SeriesRepo = typeof import("../../src/infra/db/repositories/localSeriesRepository.js");
type Parser = typeof import("../../src/modules/tv/parseTvManifest.js");
type DbModule = typeof import("../../src/infra/db/client.js");
type Schema = typeof import("../../src/infra/db/schema.js");

let seriesRepo: SeriesRepo;
let parser: Parser;
let database: DbModule;
let schema: Schema;

const manifest = {
  DVD: { Title: "Twin Peaks", Year: 1990 },
  Seasons: {
    "1": {
      Episodes: {
        "1": {
          Original: { File: "Twin Peaks\\original.mp4", Runtime: "1:30:09" },
          Alternate: { File: "Twin Peaks\\alternate.mp4", Runtime: "1:26:57" },
        },
      },
    },
  },
};

beforeAll(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "tv-series-repo-"));
  process.env["DATABASE_URL"] = path.join(tempDir, "catalog.db");
  vi.resetModules();
  database = await import("../../src/infra/db/client.js");
  schema = await import("../../src/infra/db/schema.js");
  seriesRepo = await import("../../src/infra/db/repositories/localSeriesRepository.js");
  parser = await import("../../src/modules/tv/parseTvManifest.js");
});

afterAll(async () => {
  if (previousDatabaseUrl === undefined) {
    delete process.env["DATABASE_URL"];
  } else {
    process.env["DATABASE_URL"] = previousDatabaseUrl;
  }
  database.db.$client.close();
  await rm(tempDir, { recursive: true, force: true });
});

describe("TV series repository", () => {
  it("keeps playable node ids across a rescan and drops removed versions", () => {
    const parsed = parser.parseTvManifest(manifest, "C:/tv-test");
    expect(parsed).not.toBeNull();
    if (!parsed) {
      return;
    }

    const seriesId = seriesRepo.insertDiscoveredSeries(
      {
        title: parsed.title,
        year: parsed.year,
        hasExtras: parsed.hasExtras,
        metadataFile: "C:/tv-test/twin-peaks.json",
      },
      parsed.nodes,
    );

    database.db
      .insert(schema.users)
      .values({ id: "user-1", userName: "viewer" })
      .run();

    const original = seriesRepo
      .listSeriesNodes(seriesId)
      .find((node) => node.label === "Original");
    const alternate = seriesRepo
      .listSeriesNodes(seriesId)
      .find((node) => node.label === "Alternate");
    expect(original?.url).toContain("original.mp4");
    expect(alternate?.id).toBeTypeOf("number");
    if (!original || !alternate) {
      return;
    }

    database.db
      .insert(schema.tvPlaybackProgress)
      .values([
        { userId: "user-1", nodeId: original.id, progressPercent: 40 },
        { userId: "user-1", nodeId: alternate.id, progressPercent: 10 },
      ])
      .run();

    const refreshed = parser.parseTvManifest(
      {
        DVD: { Title: "Twin Peaks", Year: 1990 },
        Seasons: {
          "1": {
            Episodes: {
              "1": {
                Original: {
                  File: "Twin Peaks\\original-remux.mp4",
                  Runtime: "1:30:09",
                },
              },
            },
          },
        },
      },
      "C:/tv-test",
    );
    expect(refreshed).not.toBeNull();
    if (!refreshed) {
      return;
    }

    expect(
      seriesRepo.refreshDiscoveredSeries(
        {
          title: "Twin Peaks",
          year: 1990,
          hasExtras: false,
          metadataFile: "C:/tv-test/twin-peaks.json",
        },
        refreshed.nodes,
      ),
    ).toBe(seriesId);

    const nodes = seriesRepo.listSeriesNodes(seriesId);
    const kept = nodes.find((node) => node.label === "Original");
    expect(kept?.id).toBe(original.id);
    expect(kept?.url).toContain("original-remux.mp4");
    expect(nodes.some((node) => node.label === "Alternate")).toBe(false);

    const progress = database.db
      .select()
      .from(schema.tvPlaybackProgress)
      .all();
    expect(progress).toHaveLength(1);
    expect(progress[0]?.nodeId).toBe(original.id);
    expect(progress[0]?.progressPercent).toBe(40);
  });
});
