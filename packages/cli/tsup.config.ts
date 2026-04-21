import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
  shims: true,
  onSuccess: "chmod +x dist/index.js 2>/dev/null || chmod +x dist/index.mjs 2>/dev/null || true",
});
