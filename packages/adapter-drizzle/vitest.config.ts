import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ["src/**/__tests__/**/*.test.ts"],
    testTimeout: 120_000,
    // Four of these files each start their own Docker container. Run them one at
    // a time: several databases racing to boot is what makes this suite flaky
    // when the whole workspace's tests run at once.
    fileParallelism: false,
    hookTimeout: 120_000,
  },
});
