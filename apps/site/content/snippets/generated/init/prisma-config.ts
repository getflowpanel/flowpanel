import { defineAdmin } from "@flowpanel/kit";
import { prismaAdapter } from "@flowpanel/kit/prisma";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/server/lib/auth";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof prisma;
    session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  }
}

export default defineAdmin({
  paths: { admin: "/admin", api: "/api/flowpanel" },
  adapter: prismaAdapter({ prisma, provider: "postgresql" }),

  auth: {
    session: getSession,
    role: (s) => s?.user.role ?? "guest",
    access: "admin",
  },

  realtime: { driver: "memory" },

  theme: {
    brand: { name: "My app" },
    mode: "auto",
  },

  resources: [
    // pnpm flowpanel new <model>  adds an entry; or write resource("User", { columns: ["email", "createdAt"] })
  ],
});
