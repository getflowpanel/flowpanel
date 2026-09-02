import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  transpilePackages: ["@flowpanel/kit", "@flowpanel/react"],
  serverExternalPackages: ["bullmq", "drizzle-orm", "pg"],
};

export default nextConfig;
