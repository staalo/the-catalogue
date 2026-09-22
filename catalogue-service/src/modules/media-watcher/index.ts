// @ts-nocheck
// Keep .js specifier for emitted ESM; tsserver may falsely flag this on Windows.
export {
  setupFileWatchers,
  stopAllWatchers,
  scanMediaDirectory,
  getScanStatus,
  getLatestScanStatus,
  collectJsonMetadataFiles,
} from "./mediaWatcherService.js";
