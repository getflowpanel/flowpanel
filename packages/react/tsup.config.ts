import { defineConfig } from "tsup";

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  dts: true,
  clean: true,
  splitting: false,
  external: ["react", "react-dom", "next", "next/navigation", "@flowpanel/core", "zod"],
  // Preserve "use client" on bundled output so Next.js RSC pipelines treat
  // the module as a client boundary. All primitives here are safe in a
  // client context, so a bundle-level banner is acceptable for M1.
  banner: { js: '"use client";' },
});
