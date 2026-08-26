import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    // This suite runs real tsc typechecks, Tailwind builds and `pnpm pack` in
    // temp directories. They saturate the pool, so the cheap tests sharing it
    // need more than vitest's 5s default when the machine is already busy.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
