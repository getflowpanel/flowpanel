import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        name: "integration",
        include: ["src/__tests__/**/*.integration.test.ts"],
      },
    ],
  },
});
