import { afterEach, describe, expect, it, vi } from "vitest";

const mkdirSyncMock = vi.fn();

vi.mock("node:fs", () => ({
  default: {
    mkdirSync: mkdirSyncMock,
  },
}));

describe("ensureSqliteParentDirectory", () => {
  afterEach(() => {
    mkdirSyncMock.mockReset();
  });

  it("creates the parent directory for a nested database path", async () => {
    const { ensureSqliteParentDirectory } =
      await import("../../src/infra/db/ensureSqliteDirectory.js");

    ensureSqliteParentDirectory("./data/catalog.db");

    expect(mkdirSyncMock).toHaveBeenCalledWith(expect.stringMatching(/data$/), {
      recursive: true,
    });
  });

  it("does not create a directory for an in-memory database", async () => {
    const { ensureSqliteParentDirectory } =
      await import("../../src/infra/db/ensureSqliteDirectory.js");

    ensureSqliteParentDirectory(":memory:");

    expect(mkdirSyncMock).not.toHaveBeenCalled();
  });

  it("does not create a directory when the database is in the current folder", async () => {
    const { ensureSqliteParentDirectory } =
      await import("../../src/infra/db/ensureSqliteDirectory.js");

    ensureSqliteParentDirectory("catalog.db");

    expect(mkdirSyncMock).not.toHaveBeenCalled();
  });
});
