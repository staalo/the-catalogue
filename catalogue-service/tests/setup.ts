import { afterEach, vi } from "vitest";

if ((process.env["SESSION_SECRET"] ?? "").length < 32) {
  process.env["SESSION_SECRET"] = "vitest-session-secret-at-least-32ch";
}

// Pin session lifetimes so tests stay on the defaults even if .env differs.
// dotenv does not override variables that are already set.
process.env["SESSION_TTL_MS"] = "3600000";
process.env["REMEMBER_ME_TTL_MS"] = "2592000000";

// Ensure spies and mocks never leak across tests.
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.resetModules();
});
