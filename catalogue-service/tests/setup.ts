import { afterEach, vi } from "vitest";

// Ensure spies and mocks never leak across tests.
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.resetModules();
});
