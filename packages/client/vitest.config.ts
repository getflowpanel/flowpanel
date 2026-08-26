import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";
export default defineConfig({
  test: {
    ...sharedTestConfig,
    environment: "happy-dom",
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
