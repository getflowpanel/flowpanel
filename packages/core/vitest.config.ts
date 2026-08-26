import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ["src/**/__tests__/**/*.test.ts", "src/__tests__/**/*.test.ts"],
  },
});
