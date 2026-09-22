import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm", "cjs"],
  outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
  dts: true,
  splitting: false,
  clean: true,
  external: ["@playwright/test", "@axe-core/playwright"],
});
