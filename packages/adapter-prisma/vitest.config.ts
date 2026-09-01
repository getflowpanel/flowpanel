import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    globals: false,
    environment: "node",
    // The PostgreSQL and MySQL suites each start their own Docker container and
    // generate a provider-specific Prisma client before the first test runs.
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    include: ["src/**/__tests__/**/*.test.ts"],
  },
});
