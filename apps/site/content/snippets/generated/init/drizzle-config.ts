import { defineAdmin } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/server/lib/db";
import * as schema from "@/server/lib/db/schema";
import { getSession } from "@/server/lib/auth";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof db;
    schema: typeof schema;
    session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  }
}

export default defineAdmin({
  paths: { admin: "/admin", api: "/api/flowpanel" },
  adapter: drizzleAdapter({ db, schema }),

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
    // pnpm flowpanel new <table>  adds an entry; or write resource(schema.users, { columns: ["email", "name", "createdAt"] })
  ],
});
