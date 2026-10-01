import { defineAdmin, resource } from "@flowpanel/kit";
import { prismaAdapter } from "@flowpanel/kit/prisma";
import { getSession } from "@/server/lib/auth";
import { prisma, type User } from "@/server/lib/prisma";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  }
  interface FlowpanelResources {
    User: User;
  }
}

export default defineAdmin({
  adapter: prismaAdapter({ prisma, provider: "postgresql" }),
  auth: {
    session: getSession,
    role: (s) => s?.user.role ?? "guest",
    requireRole: "admin",
  },
  resources: [
    resource("User", {
      columns: ["email", "name", "role", "createdAt"],
      search: ["email", "name"],
      defaultSort: { field: "createdAt", dir: "desc" },
    }),
  ],
});
