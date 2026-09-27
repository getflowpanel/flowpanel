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
  // One output module per source module, not a single bundled barrel. With a
  // lone `src/index.ts` entry tsup emits one non-splittable chunk, and the
  // module-scope side effects in here (every `createContext(…)`) stop esbuild
  // proving the unused half dead — so an app importing only `<DataTable>`
  // still paid for the whole package. Mirroring the source tree lets the
  // consumer's bundler drop whole files. See invariant I-7.
  // A fixed order, index first: tsup globs asynchronously, and entry order moves chunk boundaries.
  entry,
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  dts: true,
  clean: true,
  // Code splitting is what makes the barrel tree-shakeable. Without it tsup
  // emits one non-splittable chunk, and module-scope side effects (every
  // `createContext(…)` in here) block esbuild from proving the unused half
  // dead — so an app importing only `<DataTable>` still paid for the whole
  // package. See invariant I-7 for why that matters.
  splitting: true,
  // Externalize @flowpanel/core AND its subpaths — esbuild/dts don't treat a
  // subpath as covered by its parent, so without `/labels` the DTS bundler
  // tries to resolve @flowpanel/core/labels against core's built dist and
  // races it on a cold build.
  external: [
    "react",
    "react-dom",
    "next",
    "next/navigation",
    "@flowpanel/core",
    "@flowpanel/core/format",
    "@flowpanel/core/internal",
    "@flowpanel/core/labels",
    "@flowpanel/core/paths",
    "@flowpanel/core/publish",
    "@flowpanel/core/theme",
    "zod",
  ],
  // Preserve "use client" on bundled output so Next.js RSC pipelines treat
  // the module as a client boundary. All primitives here are safe in a
  // client context, so a bundle-level banner is acceptable for M1.
  banner: { js: '"use client";' },
});
