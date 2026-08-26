import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    globals: false,
    environment: "node",
    testTimeout: 30_000,
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
