import { fileURLToPath, URL } from "node:url";
import mdx from "fumadocs-mdx/vite";
import { configDefaults, defineConfig } from "vitest/config";
import { sharedTestConfig } from "../../vitest.shared";

export default defineConfig({
  test: {
    ...sharedTestConfig,
    exclude: [...configDefaults.exclude, "content/snippets/.generated/**"],
  },
  plugins: [mdx(undefined, { index: false, updateViteConfig: false })],
  oxc: {
    jsx: { runtime: "automatic" },
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
