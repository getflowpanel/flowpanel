import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@flowpanel/react"],
  serverExternalPackages: [
    "@flowpanel/core",
    "@flowpanel/adapter-prisma",
    "@flowpanel/adapter-drizzle",
    "@prisma/client",
  ],
};

export default nextConfig;
