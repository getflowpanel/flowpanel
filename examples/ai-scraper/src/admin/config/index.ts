import { defineAdmin } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { MetricCard } from "@/src/admin/MetricCard";
import { queues } from "@/src/admin/queues";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import { type AdminSession, getDemoSession } from "@/src/demo/auth/session";
import { overview } from "./overview";
import { aiUsage } from "./resources/ai-usage";
import { customers } from "./resources/customers";
import { invoices } from "./resources/invoices";
import { monitors } from "./resources/monitors";
import { offers } from "./resources/offers";
import { products } from "./resources/products";
import { review } from "./resources/review";
import { runs } from "./resources/runs";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof db;
  }
  interface FlowpanelResources {
    customers: typeof schema.customers.$inferSelect;
    monitors: typeof schema.monitors.$inferSelect;
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
    session: (req) => getDemoSession(req),
    role: (s) => (s as AdminSession | null)?.role ?? "guest",
    requireRole: ["admin", "support"],
  },
  shell: { mode: "tabs", brand: false },
  theme: {
    components: { MetricCard },
    accent: "217 91% 50%",
    accentDark: "217 91% 65%",
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
  resources: [customers, monitors, runs, offers, products, review, invoices, aiUsage],
  queues,
  dashboards: [overview],
});
