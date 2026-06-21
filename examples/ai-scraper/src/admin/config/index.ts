import { defineAdmin } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { headers } from "next/headers";
import { PriorityMetricCard } from "@/src/admin/PriorityMetricCard";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import { type AdminSession, getSession } from "@/src/lib/auth";
import { monitoring } from "./dashboards/monitoring";
import { overview } from "./dashboards/overview";
import { queues } from "./queues";
import { aiUsage } from "./resources/ai-usage";
import { invoices } from "./resources/invoices";
import { listings } from "./resources/listings";
import { matches } from "./resources/matches";
import { products } from "./resources/products";
import { runs } from "./resources/runs";
import { scrapers } from "./resources/scrapers";
import { users } from "./resources/users";

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
  }
  interface FlowpanelResources {
    users: typeof schema.users.$inferSelect;
    scrapers: typeof schema.scrapers.$inferSelect;
    runs: typeof schema.runs.$inferSelect;
    products: typeof schema.products.$inferSelect;
    listings: typeof schema.listings.$inferSelect;
    matches: typeof schema.matches.$inferSelect;
    invoices: typeof schema.invoices.$inferSelect;
    ai_usage: typeof schema.aiUsage.$inferSelect;
  }
}

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  readOnly: process.env.DEMO_MODE === "true",
  realtime: { driver: "memory" },
  audit: {
    enabled: true,
    sink: async (e) => {
      console.log(
        `[audit] ${e.action} ${e.resource ?? ""}#${e.targetId ?? "?"} by ${e.actorId ?? "anon"}`,
      );
    },
  },
  rateLimit: { driver: "memory", limit: 240, windowMs: 60_000, per: "ip", enabled: true },
  auth: {
    session: async () => {
      const h = await headers();
      const s = await getSession(new Request("http://flowpanel.local/", { headers: h }));
      return s ? { ...s } : null;
    },
    role: (s) => (s as AdminSession | null)?.role ?? "guest",
    requireRole: "admin",
  },
  shell: { mode: "tabs", brand: false },
  theme: {
    components: { MetricCard: PriorityMetricCard },
    accent: "217 91% 60%",
    user: (s) => {
      const session = s as AdminSession | null;
      if (!session) return undefined;
      return {
        name: session.user.name,
        email: session.email,
        items: [{ label: `Role: ${session.role}` }],
      };
    },
  },
  resources: [users, scrapers, runs, products, listings, matches, invoices, aiUsage],
  queues,
  dashboards: [overview, monitoring],
  commandPalette: {
    groups: [
      {
        label: "Actions",
        items: [{ label: "Open Overview", action: { type: "navigate", href: "/admin" } }],
      },
    ],
  },
});
