import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import type { Plugin } from "vite";
import { configDefaults, defineConfig } from "vitest/config";

const catalogueService = "http://localhost:3000";

// Windows can lock a file while Defender or another process scans it.
// Vite's watcher reports that as EBUSY and, with no listener, Node exits.
function keepDevServerAliveWhenFilesAreLocked(): Plugin {
  return {
    name: "keep-dev-server-alive-when-files-are-locked",
    configureServer(server) {
      server.watcher.on("error", (error) => {
        if (
          error instanceof Error &&
          "code" in error &&
          (error.code === "EBUSY" || error.code === "EPERM")
        ) {
          const lockedPath =
            "path" in error && typeof error.path === "string" ? error.path : "";
          const where = lockedPath ? `: ${lockedPath}` : "";
          server.config.logger.warn(`File watcher skipped a locked path${where}.`);
          return;
        }
        throw error;
      });
    },
  };
}

export default defineConfig({
  plugins: [keepDevServerAliveWhenFilesAreLocked(), react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  optimizeDeps: {
    include: [
      "@mui/material/CssBaseline",
      "@mui/material/GlobalStyles",
      "@mui/material/LinearProgress",
      "@mui/material/Tab",
      "@mui/material/Tabs",
      "@tanstack/react-query-devtools",
      "react-dom/client",
    ],
  },
  server: {
    proxy: {
      "/api": { target: catalogueService, changeOrigin: true },
      "/register": { target: catalogueService, changeOrigin: true },
      "/userlogin": { target: catalogueService, changeOrigin: true },
      "/logout": { target: catalogueService, changeOrigin: true },
      "/getcurrentuser": { target: catalogueService, changeOrigin: true },
      "/pingauth": { target: catalogueService, changeOrigin: true },
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "e2e/**"],
    coverage: {
      provider: "istanbul",
    },
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }, { browser: "firefox" }],
    },
  },
});
