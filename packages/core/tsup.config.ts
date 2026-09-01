import { rmSync } from "node:fs";
import { defineConfig } from "tsup";

// tsup runs these configs concurrently and cleans per config, so no single one
// of them may clean: whichever finished first would have its output deleted by
// a later one. Clear dist once here, before any build starts.
rmSync("dist", { recursive: true, force: true });

// Split into separate builds per entry so tsup's DTS bundler doesn't extract
// shared types into a `config-XXX.d.ts` chunk. The chunk breaks
// `declare module "@flowpanel/core" { interface FlowpanelTypes { db } }`
// augmentation: TS treats the interface inside the internal chunk as a
// different declaration site than `dist/index.d.ts`, so user augmentation
// silently drops and `ctx.db` stays `unknown`. With per-entry builds, each
// `.d.ts` declares its own types inline.
const common = {
  format: ["esm", "cjs"] as const,
  outExtension: ({ format }: { format: string }) => ({ js: format === "esm" ? ".mjs" : ".cjs" }),
  dts: true,
  splitting: false,
};

export default defineConfig([
  { entry: { index: "src/index.ts" }, ...common },
  { entry: { labels: "src/labels.ts" }, ...common },
  { entry: { auth: "src/auth/index.ts" }, ...common },
  { entry: { format: "src/format-column.ts" }, ...common },
  { entry: { "internal/migration-sql": "src/internal/migration-sql.ts" }, ...common },
]);
