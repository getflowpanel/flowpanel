import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";
import { DOC_REDIRECTS } from "./src/shared/lib/docs-contract";

const withMDX = createMDX();

// Baked in at build time: a runtime fs read does not survive the standalone trace.
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
  outputFileTracingRoot: resolve(process.cwd(), "../.."),
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex" }];
    return Promise.resolve(
      ["/api/md/:path*", "/llms.txt", "/llms-full.txt", "/llms/:path*"].map((source) => ({
        source,
        headers: noindex,
      })),
    );
  },
  redirects() {
    return Promise.resolve(
      DOC_REDIRECTS.map((redirect) => ({
        source: redirect.source,
        destination: redirect.destination,
        permanent: "permanent" in redirect ? redirect.permanent : true,
      })),
    );
  },
};

export default withMDX(nextConfig);
