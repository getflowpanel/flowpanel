import { globSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { defineConfig } from "tsup";

// tsup runs these configs concurrently and cleans per config, so no single one
// of them may clean: whichever finished first would have its output deleted by
// a later one. Clear dist once here, before any build starts.
rmSync("dist", { recursive: true, force: true });

// Use the automatic JSX runtime so the bundle emits
//   import { jsx } from "react/jsx-runtime"
// instead of bare `React.createElement(...)` calls. Bare calls require
// `React` to be in scope, which we never import explicitly in TSX files.
const sharedEsbuild = (options: { jsx?: string }): void => {
  options.jsx = "automatic";
};

/** The client barrel and every module that starts with "use client", each an entry of its own. */
function clientEntries(): Record<string, string> {
  const clients = globSync("src/**/*.{ts,tsx}").filter(
    (file) =>
      !file.includes("/__tests__/") && readFileSync(file, "utf8").startsWith('"use client"'),
  );
  return Object.fromEntries([
    ["client", "src/client.ts"],
    ...clients.sort().map((file) => [`client/${file.slice(4).replace(/\.tsx?$/, "")}`, file]),
  ]);
}

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    splitting: false,
    esbuildOptions: sharedEsbuild,
    external: [
      "next",
      "next/navigation",
      "react",
      "react-dom",
      "@flowpanel/core",
      "@flowpanel/react",
      "@flowpanel/next/client",
      "zod",
    ],
  },
  // One chunk per client component, each its own boundary; the barrel carries no directive.
  {
    entry: clientEntries(),
    format: ["esm"],
    dts: { entry: { client: "src/client.ts" } },
    splitting: true,
    esbuildOptions: sharedEsbuild,
    external: [
      "next",
      "next/navigation",
      "react",
      "react-dom",
      "@flowpanel/core",
      "@flowpanel/react",
      "zod",
    ],
    banner: { js: '"use client";' },
    onSuccess: async () => {
      const barrel = "dist/client.js";
      writeFileSync(barrel, readFileSync(barrel, "utf8").replace(/^"use client";\n/, ""));
    },
  },
]);
