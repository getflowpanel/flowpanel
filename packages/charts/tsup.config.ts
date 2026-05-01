import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
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
