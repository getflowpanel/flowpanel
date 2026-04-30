import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outExtension: () => ({ js: ".mjs" }),
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  splitting: false,
  shims: true,
  // Templates ship as real files in `dist/templates/` and are read at runtime
  // via `template.ts`. Keep them outside the bundle so users can inspect the
  // rendered source (and so the bundle stays small).
  external: ["jiti"],
  onSuccess: async () => {
    const src = resolve("src/templates");
    const dst = resolve("dist/templates");
    if (existsSync(src)) cpSync(src, dst, { recursive: true });
  },
});
