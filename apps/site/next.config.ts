import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

// Read the umbrella package version at build time (cwd is apps/site during
// `next build`) and inline it via env. A runtime fs read does not survive the
// standalone trace, so the version must be baked in here.
const flowpanelVersion = (
  JSON.parse(
    readFileSync(resolve(process.cwd(), "../../packages/flowpanel/package.json"), "utf8"),
  ) as { version: string }
).version;

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_FLOWPANEL_VERSION: flowpanelVersion,
  },
  // Required so the monorepo standalone trace includes workspace packages.
  // Using a relative path avoids ESM/__dirname headaches in compiled config.
  outputFileTracingRoot: "../..",
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default withMDX(nextConfig);
