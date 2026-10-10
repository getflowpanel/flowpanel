import { globSync } from "node:fs";
import { defineConfig } from "tsup";

const modules = globSync("src/**/*.{ts,tsx}")
  .filter(
    (file) => !file.includes("/__tests__/") && !file.includes(".test.") && file !== "src/index.ts",
  )
  .sort();
const entry = Object.fromEntries(
  ["src/index.ts", ...modules].map((file) => [file.slice(4).replace(/\.tsx?$/, ""), file]),
);

export default defineConfig({
  // One module per source file, index first, so a host's bundler drops whole files it never imports.
  entry,
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  dts: true,
  clean: true,
  splitting: true,
  // Every core subpath is listed: the DTS bundler does not treat a subpath as covered by its parent.
  external: [
    "react",
    "react-dom",
    "next",
    "next/navigation",
    "@flowpanel/core",
    "@flowpanel/core/class-names",
    "@flowpanel/core/format",
    "@flowpanel/core/internal",
    "@flowpanel/core/labels",
    "@flowpanel/core/paths",
    "@flowpanel/core/publish",
    "@flowpanel/core/theme",
    "zod",
  ],
  // Next.js treats every module here as a client boundary.
  banner: { js: '"use client";' },
});
