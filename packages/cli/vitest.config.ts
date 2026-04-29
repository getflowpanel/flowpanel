import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

/**
 * Widget templates ship as `.tpl` files (real TSX source kept out of the
 * TypeScript compile graph). tsup inlines them via esbuild's `text` loader
 * at build time; under Vitest we replicate that with a tiny Vite plugin so
 * `import x from "./foo.tpl"` yields the file contents as a string.
 */
export default defineConfig({
  plugins: [
    {
      name: "flowpanel-cli-tpl-as-text",
      enforce: "pre",
      load(id) {
        if (id.endsWith(".tpl")) {
          const source = readFileSync(id, "utf-8");
          return `export default ${JSON.stringify(source)};`;
        }
        return null;
      },
    },
  ],
});
