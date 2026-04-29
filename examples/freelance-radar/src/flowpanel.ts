/**
 * freelance-radar admin — end-to-end FlowPanel demo on Drizzle + Postgres.
 *
 * Covers:
 *   - Typed resource builder (Drizzle tables + relations + enums + JSON)
 *   - Row actions with confirm + stepUp + disabled
 *   - computeBatch for N+1-safe computed columns (see users.totalPaid)
 *   - B2 metric helpers: mrr (scalar + trend), signups (time series),
 *     aiSpendByModel (breakdown)
 *
 * Module augmentation lives in ./flowpanel-types.d.ts — `ctx.db` is
 * typed as `typeof db` everywhere, no `as typeof db` casts.
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
  realtime: true,
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
      computeBatch: async ({ rows, db }) => {
        const ids = rows.map((r) => r.id);
        if (ids.length === 0) return new Map();
        const byUser = await db
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
      run: async ({ row, db }) => {
        await db.update(users).set({ plan: "pro" }).where(eq(users.id, row.id));
      },
    },
    cancel: {
      type: "row",
      label: "Cancel subscription",
      confirm: "Cancel this subscription? Access revoked immediately.",
      stepUp: true,
      run: async ({ row, db }) => {
        await db.update(users).set({ status: "canceled" }).where(eq(users.id, row.id));
      },
    },
  },
});

const jobResource = defineResource<JobRow>(jobs, {
  columns: (j) => [j.title, j.platform, j.categoryId, j.priceUsd, j.postedAt, j.archived],
  filters: (j) => [j.platform, j.categoryId, j.postedAt, j.archived],
  defaultSort: { field: "postedAt", dir: "desc" },
});

const paymentResource = defineResource<PaymentRow>(payments, {
  label: "Payment",
  realtime: true,
  columns: (p) => [p.id, p.userId, p.amountRub, p.status, p.ukassaId, p.paidAt],
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
      run: async ({ row, db }) => {
        await refundUkassaPayment(row.ukassaId);
        await db.update(payments).set({ status: "refunded" }).where(eq(payments.id, row.id));
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
  compute: async ({ db }, { start, end }) => {
    const [r] = await db
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
  compute: async ({ db }, { start, end, bucket }) => {
    const result = await db.execute<{ t: string; c: number }>(drizzleSql`
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
  compute: async ({ db }, { range }) => {
    const conds = range ? between(aiCosts.createdAt, range.start, range.end) : undefined;
    const rows = await db
      .select({ label: aiCosts.model, v: sum(aiCosts.costUsd) })
      .from(aiCosts)
      .where(conds)
      .groupBy(aiCosts.model);
    return rows.map((r) => ({ label: r.label, value: Number(r.v ?? 0) }));
  },
});

// ─── Root config ───────────────────────────────────────────────────────────

export const flowpanel = defineFlowPanel({
  appName: "freelance-radar",
  basePath: "/admin",
  timezone: "Europe/Moscow",

  adapter: drizzleAdapter({ db, schema }),

  resources: {
    user: userResource,
    job: jobResource,
    payment: paymentResource,
    aiCost: aiCostResource,
  },

  // Dashboard — each widget evaluates its loader on the server; the
  // client receives JSON payloads. `...mrr` spreads { value, trend }
  // from metric() into w.metric(). For a sections-grouped layout see
  // docs/reference/dashboard.md#sections.
  dashboard: (w) => [
    w.metric({
      label: "MRR",
      format: "money",
      prefix: "₽",
      layout: { span: 4 },
      ...mrr,
    }),
    w.chart({
      label: "Sign-ups",
      kind: "line",
      data: signups,
    }),
    w.chart({
      label: "AI spend by model",
      kind: "bar",
      format: "money",
      data: aiSpendByModel,
    }),
  ],

  pipeline: {
    stages: ["parse", "score", "notify"] as const,
    fields: {},
    stageFields: { parse: {}, score: {}, notify: {} },
  },

  security: {
    auth: { getSession },
  },
});
