import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { configDefaults, defineConfig } from "vitest/config";

const catalogueService = "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
