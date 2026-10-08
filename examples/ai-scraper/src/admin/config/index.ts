import { defineAdmin } from "@flowpanel/kit";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { queues } from "@/src/admin/queues";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import { type AdminSession, getDemoSession } from "@/src/demo/auth/session";
import { readSandboxConfig } from "@/src/demo/sandbox/config";
import { requireSandboxId } from "@/src/demo/sandbox/scope";
import { overview } from "./dashboards/overview";
import { aiUsage } from "./resources/ai-usage";
import { customers } from "./resources/customers";
import { invoices } from "./resources/invoices";
import { listings } from "./resources/listings";
import { matches } from "./resources/matches";
import { monitors } from "./resources/monitors";
import { products } from "./resources/products";
import { runs } from "./resources/runs";

declare module "@flowpanel/kit" {
  interface FlowpanelTypes {
    db: typeof db;
    schema: typeof schema;
    session: AdminSession;
  }
}

const sandboxConfig = readSandboxConfig();

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  readOnly: sandboxConfig.readOnly,
  scope: ({ session }) => ({ sandboxId: requireSandboxId(session) }),
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
    role: (s) => s?.role ?? "guest",
    userId: (s) => s?.user.id ?? null,
    access: ["admin", "support"],
  },
  shell: { mode: "tabs", brand: false, skipLink: false },
  theme: {
    user: (s) =>
      s ? { name: s.user.name, email: s.email, items: [{ label: `Role: ${s.role}` }] } : undefined,
  },
  resources: [customers, monitors, runs, listings, products, matches, invoices, aiUsage],
  queues,
  dashboards: [overview],
});
