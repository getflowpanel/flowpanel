import { rmSync } from "node:fs";
import { defineConfig } from "tsup";

// tsup runs these configs concurrently and cleans per config, so no single one
// of them may clean: whichever finished first would have its output deleted by
// a later one. Clear dist once here, before any build starts.
rmSync("dist", { recursive: true, force: true });

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    splitting: false,
    external: ["react", "recharts", "@flowpanel/core", "@flowpanel/react"],
  },
  {
    entry: { runtime: "src/runtime.tsx" },
    format: ["esm"],
    dts: true,
    splitting: false,
    external: ["react", "recharts", "@flowpanel/core", "@flowpanel/react"],
    banner: { js: '"use client";' },
  },
]);
