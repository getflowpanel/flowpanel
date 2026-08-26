import { defineAdmin, resource } from "@flowpanel/kit";
import { prismaAdapter } from "@flowpanel/kit/prisma";
import { getSession } from "@/server/lib/auth";
import { prisma, type User } from "@/server/lib/prisma";

declare module "@flowpanel/kit" {
  interface FlowpanelResources {
    User: User;
  }
}

export default defineAdmin({
  adapter: prismaAdapter({ prisma }),
  auth: {
    session: getSession,
    role: (session) => (session as { user?: { role?: string } } | null)?.user?.role ?? "guest",
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
