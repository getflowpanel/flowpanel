import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    splitting: false,
    clean: true,
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
