import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: [{ find: "@", replacement: fileURLToPath(new URL(".", import.meta.url)) }],
  },
  test: { ...sharedTestConfig },
});
