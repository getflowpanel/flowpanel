import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts", labels: "src/labels.ts", auth: "src/auth/index.ts" },
  format: ["esm", "cjs"],
  // Emit consistent `.mjs` + `.cjs` so package.json's import/require
  // exports match file-system reality (tsup's default `.js` + `.mjs`
  // was mismatched with the historical `.cjs`/`.js` package.json entries).
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
  dts: true,
  clean: true,
  splitting: false,
});
