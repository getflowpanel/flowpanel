import { fileURLToPath, URL } from "node:url";
import mdx from "fumadocs-mdx/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
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
