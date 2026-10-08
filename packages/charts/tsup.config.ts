import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.tsx" },
  format: ["esm"],
  dts: true,
  splitting: false,
  clean: true,
  external: ["react", "recharts", "@flowpanel/core", "@flowpanel/react"],
  banner: { js: '"use client";' },
});
