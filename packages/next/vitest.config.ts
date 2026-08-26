import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";
export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    ...sharedTestConfig,
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
  },
});
