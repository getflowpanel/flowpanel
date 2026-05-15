import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    next: "src/next.ts",
    drizzle: "src/drizzle.ts",
    react: "src/react.ts",
    client: "src/client.ts",
    bullmq: "src/bullmq.ts",
    server: "src/server.ts",
    charts: "src/charts.ts",
    prisma: "src/prisma.ts",
    auth: "src/auth.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: false,
  clean: true,
  external: [
    "next",
    "react",
    "react-dom",
    "drizzle-orm",
    "zod",
    "tailwindcss",
    "bullmq",
    "ioredis",
    "@prisma/client",
    "recharts",
    "@flowpanel/charts",
    "@flowpanel/charts/runtime",
  ],
});
