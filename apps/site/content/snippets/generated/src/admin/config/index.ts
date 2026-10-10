import { defineAdmin } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { flowpanelAuth } from "@/server/lib/flowpanel-session";
import { resources } from "@/admin/config/resources";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof db;
    schema: typeof schema;
  }
}

export default defineAdmin({
  paths: { admin: "/admin", api: "/api/flowpanel" },
  adapter: drizzleAdapter({ db, schema }),

  auth: flowpanelAuth,

  realtime: { driver: "memory" },

  theme: {
    brand: { name: "scrapeai" },
    mode: "auto",
  },

  resources: [...resources],
});
