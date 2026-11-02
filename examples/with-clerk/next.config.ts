import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["drizzle-orm", "pg"],
};

export default nextConfig;
