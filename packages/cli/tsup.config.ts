import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
  shims: true,
  // Widget templates live as `.tpl` files next to the code that imports them.
  // esbuild inlines each as a string via the `text` loader, so the templates
  // land inside `dist/index.mjs` — no extra copy step, no runtime `fs`.
  loader: {
    ".tpl": "text",
  },
  onSuccess: "chmod +x dist/index.js 2>/dev/null || chmod +x dist/index.mjs 2>/dev/null || true",
});
