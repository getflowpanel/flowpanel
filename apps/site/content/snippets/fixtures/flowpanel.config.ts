import { defineAdmin, resource } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { getSession } from "@/lib/auth";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: { session: getSession, role: (s) => s?.user.role ?? "guest", access: "admin" },
  resources: [
    resource(schema.customers, {
      name: "customers",
      columns: ["email", "name", "plan", "status", "createdAt"],
    }),
    resource(schema.orders, {
      name: "orders",
      columns: ["number", "customerEmail", "status", "total", "createdAt"],
    }),
  ],
});
