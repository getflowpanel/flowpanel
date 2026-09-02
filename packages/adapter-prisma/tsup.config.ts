import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  dts: true,
  clean: true,
  target: "es2022",
  external: ["@flowpanel/core", "@flowpanel/core/internal/migration-sql", "@prisma/client", "zod"],
});
