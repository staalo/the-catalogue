import { afterEach, vi } from "vitest";

if ((process.env["SESSION_SECRET"] ?? "").length < 32) {
  process.env["SESSION_SECRET"] = "vitest-session-secret-at-least-32ch";
}

// Ensure spies and mocks never leak across tests.
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.resetModules();
});
