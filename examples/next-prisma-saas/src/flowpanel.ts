import { defineFlowPanel, resource } from "@flowpanel/core";
import { prisma } from "./db";

export const flowpanel = defineFlowPanel({
  appName: "Example SaaS",
  // PrismaClient is auto-detected; @flowpanel/adapter-prisma is required at runtime
  adapter: prisma,
  pipeline: {
    stages: ["pending", "active", "done"],
  },
  security: {
    auth: {
      // Replace with your real auth (e.g. NextAuth getServerSession)
      getSession: async () => ({ id: "dev", email: "dev@localhost", role: "admin" }),
    },
  },
  resources: {
    user: resource("User"),
    post: resource("Post"),
  },
});
