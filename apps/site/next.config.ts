import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  output: "standalone",
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
