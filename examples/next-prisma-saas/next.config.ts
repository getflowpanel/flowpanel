import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@flowpanel/core", "@flowpanel/react", "@flowpanel/adapter-prisma"],
};

export default nextConfig;
