import { defineConfig } from "tsup";

// Use the automatic JSX runtime so the bundle emits
//   import { jsx } from "react/jsx-runtime"
// instead of bare `React.createElement(...)` calls. Bare calls require
// `React` to be in scope, which we never import explicitly in TSX files.
const sharedEsbuild = (options: { jsx?: string }): void => {
  options.jsx = "automatic";
};

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    splitting: false,
    clean: true,
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
  // Client-only modules (React error boundary, URL-bound DateRangePicker
  // wrapper) live in a separate bundle so the "use client" banner is applied
  // exactly at the RSC boundary. The server bundle imports them via the
  // `./client` subpath export.
  {
    entry: { client: "src/client.ts" },
    format: ["esm"],
    dts: true,
    splitting: false,
    clean: false,
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
  },
]);
