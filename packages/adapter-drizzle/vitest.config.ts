import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests: all .test.ts files except integration
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["src/__tests__/**/*.integration.test.ts"],
  },
});
