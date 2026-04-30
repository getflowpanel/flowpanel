import { defineAdmin, resource } from "flowpanel";
import { drizzleAdapter } from "flowpanel/drizzle";
import { headers } from "next/headers";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import { type AdminSession, getSession } from "@/src/lib/auth";

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  auth: {
    session: async () => {
      const h = await headers();
      const url = h.get("x-url") ?? "http://localhost/";
      const s = await getSession(new Request(url, { headers: h }));
      return s ? { ...s } : null;
    },
    role: (s) => (s as AdminSession | null)?.role ?? "guest",
    requireRole: "admin",
  },
  theme: { brand: { name: "FreelanceRadar" } },
  resources: [
    resource(schema.users, {
      label: "Users",
      columns: ["email", "plan", "status", "createdAt"],
      search: ["email", "telegramId"],
      filters: ["plan", "status"],
      defaultSort: { field: "createdAt", dir: "desc" },
    }),
    resource(schema.categories, {
      label: "Categories",
      columns: ["name", "slug", "parentId", "createdAt"],
      search: ["name", "slug"],
    }),
    resource(schema.jobs, {
      label: "Jobs",
      columns: ["title", "platform", "priceUsd", "postedAt", "archived"],
      search: ["title", "description"],
      filters: ["platform", "archived"],
      defaultSort: { field: "postedAt", dir: "desc" },
    }),
    resource(schema.payments, {
      label: "Payments",
      columns: ["userId", "amountRub", "status", "createdAt"],
      filters: ["status"],
      defaultSort: { field: "createdAt", dir: "desc" },
    }),
  ],
});
