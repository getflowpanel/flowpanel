import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  serverExternalPackages: ["bullmq", "drizzle-orm", "pg"],
};

export default nextConfig;
