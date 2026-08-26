import { fileURLToPath, URL } from "node:url";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: { ...sharedTestConfig },
  plugins: [mdx(undefined, { index: false, updateViteConfig: false })],
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    alias: [
      {
        find: "@/.source",
        replacement: fileURLToPath(new URL("./.source", import.meta.url)),
      },
      {
        find: "@",
        replacement: fileURLToPath(new URL("./src", import.meta.url)),
      },
    ],
  },
});
