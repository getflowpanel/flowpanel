import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        name: "unit",
        include: ["src/__tests__/**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/dist/**", "src/__tests__/**/*.integration.test.ts"],
      },
      {
        name: "integration",
        include: ["src/__tests__/**/*.integration.test.ts"],
      },
    ],
  },
});
