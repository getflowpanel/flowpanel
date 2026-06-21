import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@flowpanel/core", "@flowpanel/react", "@flowpanel/adapter-drizzle"],
  serverExternalPackages: ["drizzle-orm", "pg"],
};

export default nextConfig;
