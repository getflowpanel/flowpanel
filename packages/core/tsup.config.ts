import { defineConfig } from "tsup";

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
  { entry: { index: "src/index.ts" }, clean: true, ...common },
  { entry: { labels: "src/labels.ts" }, clean: false, ...common },
  { entry: { auth: "src/auth/index.ts" }, clean: false, ...common },
  { entry: { format: "src/format-column.ts" }, clean: false, ...common },
]);
