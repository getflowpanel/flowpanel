import {
  type DetailBadge,
  type DetailOptions,
  kv,
  metric,
  resource,
  stat,
  table,
} from "@flowpanel/core";
import { expectAssignable, expectError } from "tsd";

type User = { id: number; email: string; plan: string };
declare const users: { $inferSelect: User };

const card = {
  title: (u, { format }) => `${u.email} · ${format.number(u.id)}`,
  subtitle: async (u) => u.plan,
  badge: (u) => [
    { label: u.plan, tone: "accent" },
    null,
    { label: "Visits", href: { resource: "visits", filter: { userId: u.id } } },
  ],
  dateRange: { preset: "last30d", presets: ["last7d", "last30d"] },
  stats: [metric("Visits", { count: "visits", range: "startedAt" }), stat("Plan", "pro")],
  aside: [kv({ items: [{ label: "Email", field: "email" }] })],
} satisfies DetailOptions<User>;

resource(users, { detail: card });
expectAssignable<DetailBadge>({ label: "Paid" });
expectError(resource(users, { detail: { stats: [table({ resource: "visits" })] } }));

kv({ record: async () => ({ plan: "pro" }), items: [{ label: "Plan", field: "plan" }] });
expectError(
  kv({ record: async () => ({ plan: "pro" }), items: [{ label: "Plan", field: "plna" }] }),
);
