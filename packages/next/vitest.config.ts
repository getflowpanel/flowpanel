import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";
export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    ...sharedTestConfig,
    setupFiles: ["../../vitest.browser-storage.ts", "./vitest.setup-ui.ts"],
    environment: "node",
    include: ["src/**/__tests__/**/*.test.{ts,tsx}"],
  },
});
