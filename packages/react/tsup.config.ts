import { globSync, readFileSync, writeFileSync } from "node:fs";
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
  // Every module is a client boundary but the barrel, so a page loads only the components it imports.
  banner: { js: '"use client";' },
  onSuccess: async () => {
    const barrel = "dist/index.mjs";
    writeFileSync(barrel, readFileSync(barrel, "utf8").replace(/^"use client";\n/, ""));
  },
});
