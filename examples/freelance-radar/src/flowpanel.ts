/**
 * freelance-radar admin — target configuration for FlowPanel 1.0.
 *
 * This file grows as the B-series tasks land. Currently:
 *   B1 ✅  typed resource builder (Drizzle) — the blocks below compile
 *   B2 ⏳  metrics via Drizzle-native query builder
 *   B5 ⏳  realtime opt-in
 *   B7 ⏳  theme tokens
 *   B8 ⏳  widget namespace (w.metric / w.chart / w.table / w.kv / w.activity)
 *
 * The commented sections illustrate the intended final shape; they'll be
 * uncommented as each B task reaches main.
 */

import "server-only";
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { breakdown, defineFlowPanel, defineResource, metric, timeseries } from "@flowpanel/core";
import { and, between, sql as drizzleSql, eq, type InferSelectModel, sum } from "drizzle-orm";
import { db } from "./db/client";
import * as schema from "./db/schema";
import { getSession } from "./lib/auth";
import { refundUkassaPayment } from "./lib/ukassa";

const { users, jobs, payments, aiCosts } = schema;

type UserRow = InferSelectModel<typeof users>;
type JobRow = InferSelectModel<typeof jobs> & {
  category: { id: number; name: string } | null;
};
type PaymentRow = InferSelectModel<typeof payments> & {
  user: { email: string } | null;
};
type AiCostRow = InferSelectModel<typeof aiCosts>;

// ─── Resources ─────────────────────────────────────────────────────────────

const userResource = defineResource<UserRow>(users, {
  label: "User",
  columns: (u) => [
    u.id,
    u.email,
    u.telegramId,
    u.plan,
    u.status,
    u.createdAt,
    u.lastSeenAt,
    {
      id: "totalPaid",
      label: "Total paid",
      format: "money",
      // computeBatch — avoids N+1 on list queries.
      computeBatch: async ({ rows, db: ctxDb }) => {
        const d = ctxDb as typeof db;
        const ids = rows.map((r) => r.id);
        if (ids.length === 0) return new Map();
        const byUser = await d
          .select({ userId: payments.userId, v: sum(payments.amountRub) })
          .from(payments)
          .where(and(eq(payments.status, "succeeded")))
          .groupBy(payments.userId);
        const map = new Map<number, number>();
        for (const row of byUser) map.set(row.userId, Number(row.v ?? 0));
        return map;
      },
    },
  ],
  filters: (u) => [u.plan, u.status, u.createdAt],
  actions: {
    promote: {
      type: "row",
      label: "Promote to Pro",
      icon: "star",
      run: async ({ row, db: ctxDb }) => {
        const d = ctxDb as typeof db;
        await d.update(users).set({ plan: "pro" }).where(eq(users.id, row.id));
      },
    },
    cancel: {
      type: "row",
      label: "Cancel subscription",
      confirm: "Cancel this subscription? Access revoked immediately.",
      stepUp: true,
      run: async ({ row, db: ctxDb }) => {
        const d = ctxDb as typeof db;
        await d.update(users).set({ status: "canceled" }).where(eq(users.id, row.id));
      },
    },
  },
});

const jobResource = defineResource<JobRow>(jobs, {
  columns: (j) => [j.title, j.platform, j.category, j.priceUsd, j.postedAt, j.archived],
  filters: (j) => [j.platform, j.category, j.postedAt, j.archived],
  defaultSort: { field: "postedAt", dir: "desc" },
});

const paymentResource = defineResource<PaymentRow>(payments, {
  label: "Payment",
  columns: (p) => [p.id, p.user, p.amountRub, p.status, p.ukassaId, p.paidAt],
  filters: (p) => [p.status, p.createdAt],
  defaultSort: { field: "createdAt", dir: "desc" },
  actions: {
    refund: {
      type: "row",
      label: "Refund",
      icon: "undo",
      confirm: ({ row }) =>
        `Refund ₽${(row.amountRub / 100).toFixed(2)} to ${row.user?.email ?? "user"}?`,
      stepUp: true,
      disabled: ({ row }) => row.status !== "succeeded",
      run: async ({ row, db: ctxDb }) => {
        const d = ctxDb as typeof db;
        await refundUkassaPayment(row.ukassaId);
        await d.update(payments).set({ status: "refunded" }).where(eq(payments.id, row.id));
      },
    },
  },
});

const aiCostResource = defineResource<AiCostRow>(aiCosts, {
  label: "AI cost",
  columns: (c) => [
    c.id,
    c.userId,
    c.provider,
    c.model,
    c.tokensIn,
    c.tokensOut,
    c.costUsd,
    c.createdAt,
  ],
  filters: (c) => [c.provider, c.model, c.createdAt],
  defaultSort: { field: "createdAt", dir: "desc" },
});

// ─── Metrics (B2 ✅) ──────────────────────────────────────────────────────
//
// Three helper shapes cover the common patterns. `compute` is ORM-agnostic
// (the user casts ctx.db); the helpers handle ranges + trend math.

// Scalar + auto vs-previous-period trend — `...mrr` spreads into w.metric().
export const mrr = metric({
  defaultRange: "30d",
  trend: "vs-previous-period",
  compute: async ({ db: ctxDb }, { start, end }) => {
    const d = ctxDb as typeof db;
    const [r] = await d
      .select({ v: sum(payments.amountRub) })
      .from(payments)
      .where(and(eq(payments.status, "succeeded"), between(payments.paidAt, start, end)));
    return Number(r?.v ?? 0);
  },
});

// Time series for w.chart({ kind: "line", data: signups }).
export const signups = timeseries({
  defaultRange: "30d",
  defaultBucket: "day",
  compute: async ({ db: ctxDb }, { start, end, bucket }) => {
    const d = ctxDb as typeof db;
    const result = await d.execute<{ t: string; c: number }>(drizzleSql`
      SELECT date_trunc(${bucket}, ${users.createdAt}) AS t, COUNT(*)::int AS c
      FROM ${users}
      WHERE ${users.createdAt} >= ${start} AND ${users.createdAt} < ${end}
      GROUP BY t ORDER BY t
    `);
    return result.rows.map((r) => ({
      label: new Date(r.t).toISOString().slice(0, 10),
      value: r.c,
    }));
  },
});

// Breakdown for w.chart({ kind: "bar", data: aiSpendByModel }).
export const aiSpendByModel = breakdown({
  defaultRange: "30d",
  sort: "value-desc",
  limit: 10,
  compute: async ({ db: ctxDb }, { range }) => {
    const d = ctxDb as typeof db;
    const conds = range ? between(aiCosts.createdAt, range.start, range.end) : undefined;
    const rows = await d
      .select({ label: aiCosts.model, v: sum(aiCosts.costUsd) })
      .from(aiCosts)
      .where(conds)
      .groupBy(aiCosts.model);
    return rows.map((r) => ({ label: r.label, value: Number(r.v ?? 0) }));
  },
});

// ─── Root config (B1+B2 surface — widgets/drawers/theme arrive in B5/B7/B8) ─

export const flowpanel = defineFlowPanel({
  appName: "freelance-radar",
  basePath: "/admin",
  timezone: "Europe/Moscow",

  // biome-ignore lint/suspicious/noExplicitAny: zod adapter union accepts the runtime shape but TS infers too strict
  adapter: drizzleAdapter({ db, schema }) as any,

  resources: {
    user: userResource,
    job: jobResource,
    payment: paymentResource,
    aiCost: aiCostResource,
  },

  pipeline: {
    stages: ["parse", "score", "notify"] as const,
    fields: {},
    stageFields: { parse: {}, score: {}, notify: {} },
  },

  security: {
    auth: { getSession },
  },
});

// B2 ✅ metrics helpers (metric/timeseries/breakdown) — above
// TODO(B5): realtime: true opt-in on resources + widgets
// TODO(B7): theme tokens (preset + token overrides)
// TODO(B8): widgets { mrr: w.metric({ ...mrr }), aiSpend: w.chart({ data: aiSpendByModel }) }
// TODO(B8): dashboards with sections + grid layout
