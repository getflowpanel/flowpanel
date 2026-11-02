import { defineAdmin, resource } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { getSession } from "@/server/lib/auth";
import { db } from "@/server/lib/db";
import * as schema from "@/server/lib/db/schema";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof db;
    // Every table and view in the schema becomes a typed resource name and row.
    schema: typeof schema;
    session: NonNullable<Awaited<ReturnType<typeof getSession>>>;
  }
}

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: {
    session: getSession,
    role: (s) => s?.user.role ?? "guest",
    access: "admin",
  },
  resources: [
    resource(schema.users, {
      columns: ["email", "name", "role", "createdAt"],
      search: ["email", "name"],
      defaultSort: { field: "createdAt", dir: "desc" },
    }),
  ],
});
