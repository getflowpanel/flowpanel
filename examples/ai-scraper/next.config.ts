import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@flowpanel/kit", "@flowpanel/core", "@flowpanel/react"],
  serverExternalPackages: ["drizzle-orm", "pg"],
};

export default nextConfig;
