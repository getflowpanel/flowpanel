import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  dts: true,
  clean: true,
  external: [
    "@flowpanel/core",
    "@flowpanel/core/internal/migration-sql",
    "drizzle-orm",
    "drizzle-zod",
    "zod",
  ],
});
