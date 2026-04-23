import "server-only";
import { prismaAdapter } from "@flowpanel/adapter-prisma";
import { defineFlowPanel, defineResource } from "@flowpanel/core";
import type { Post, User } from "@prisma/client";
import { prisma } from "./db";

// prismaAdapter({ prisma }) must be called before defineResource so the
// bridge registers each delegate (prisma.user, prisma.post) with FlowPanel.
const adapter = prismaAdapter({ prisma });

export const flowpanel = defineFlowPanel({
  appName: "Example SaaS",
  timezone: "UTC",
  basePath: "/admin",
  adapter,
  pipeline: {
    stages: ["pending", "active", "done"] as const,
    fields: {},
    stageFields: {
      pending: {},
      active: {},
      done: {},
    },
  },
  security: {
    auth: {
      // Replace with your real auth (e.g. NextAuth getServerSession)
      getSession: async () => ({ id: "dev", email: "dev@localhost", role: "admin" }),
    },
  },
  resources: {
    user: defineResource<User>(prisma.user, {
      columns: (u) => [u.id, u.email, u.name, u.createdAt],
      filters: (u) => [u.email, u.createdAt],
    }),
    post: defineResource<Post>(prisma.post, {
      columns: (p) => [p.id, p.title, p.createdAt],
      filters: (p) => [p.createdAt],
    }),
  },
});
