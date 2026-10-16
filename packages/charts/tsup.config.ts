import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.tsx", renderer: "src/renderer.tsx" },
  format: ["esm"],
  dts: true,
  splitting: true,
  clean: true,
  external: ["react", "recharts", "@flowpanel/core", "@flowpanel/react"],
  banner: { js: '"use client";' },
});
