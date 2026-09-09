import fs from "node:fs";
import path from "node:path";

/**
 * better-sqlite3 creates the database file, but not missing parent directories.
 * Fresh clones do not have `data/` because it is gitignored.
 */
export function ensureSqliteParentDirectory(dbUrl: string): void {
  if (dbUrl === ":memory:") {
    return;
  }

  const directory = path.dirname(dbUrl);
  if (!directory || directory === ".") {
    return;
  }

  fs.mkdirSync(directory, { recursive: true });
}
