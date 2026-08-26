import { defineConfig } from "tsup";

// tsup runs these concurrently, so none of them may clean: whichever finishes
// first would have its output deleted by a later one. The build script clears
// dist once, before tsup starts.
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
    clean: false,
    splitting: false,
    external: ["react", "recharts", "@flowpanel/core", "@flowpanel/react"],
    banner: { js: '"use client";' },
  },
]);
