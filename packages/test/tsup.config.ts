import { rmSync } from "node:fs";
import { defineConfig } from "tsup";

rmSync("dist", { recursive: true, force: true });

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    outExtension: ({ format }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
    dts: true,
    splitting: false,
    external: ["@playwright/test", "@axe-core/playwright"],
  },
  {
    entry: { widgets: "src/widgets.ts" },
    format: ["esm"],
    outExtension: () => ({ js: ".mjs" }),
    dts: true,
    splitting: false,
    external: ["@flowpanel/core", "@flowpanel/next"],
  },
]);
