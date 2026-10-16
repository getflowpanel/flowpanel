import { defineAdmin } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getSession } from "@/server/lib/auth";
import { resources } from "@/admin/config/resources";

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
    brand: { name: "scrapeai" },
    mode: "auto",
  },

  resources: [...resources],
});
