/**
 * freelance-radar admin — target configuration for FlowPanel 1.0.
 *
 * This file is the **API spec** for the 1.0 milestone. It does NOT compile
 * against current @flowpanel/core — it describes the shape we're building
 * toward (task B1: typed resource builder, task B2: metrics builder, task
 * B5: realtime, task B7: theme tokens, task B8: widget namespace).
 *
 * Success criteria:
 *   - ≤ 300 LOC total
 *   - 0 `any`, 0 non-null assertions
 *   - 100% type inference from the Drizzle schema — no manual column types
 *   - every user-visible string / action is declared here (no side files)
 */

import "server-only";
import { drizzleAdapter } from "@flowpanel/adapter-drizzle";
import { defineDrawer, defineFlowPanel, definePage, defineResource, w } from "@flowpanel/core";
import { and, desc, eq, gte, sql, sum } from "drizzle-orm";
import { AiCostsDetailPage } from "./pages/AiCostsDetailPage";
import { CategoryTreeEditor } from "./pages/CategoryTreeEditor";
import * as schema from "./db/schema";
import { db } from "./db/client";
import { getSession } from "./lib/auth";
import { refundUkassaPayment } from "./lib/ukassa";

const { users, jobs, payments, aiCosts, categories } = schema;

// ─── Resources ────────────────────────────────────────────────────────────

const userResource = defineResource(users, {
  label: "User",
  columns: (u) => [
    u.id,
    u.email,
    u.telegramId,
    u.plan, // enum narrowed to "free" | "pro" | "team"
    u.status,
    u.createdAt,
    u.lastSeenAt,
    {
      id: "totalPaid",
      label: "Total paid",
      format: "currency:rub",
      compute: async ({ row, db }) =>
        db
          .select({ sum: sum(payments.amountRub) })
          .from(payments)
          .where(and(eq(payments.userId, row.id), eq(payments.status, "succeeded")))
          .then((r) => Number(r[0]?.sum ?? 0)),
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
    ban: {
      type: "row",
      label: "Cancel subscription",
      confirm: "Cancel this user's subscription? They will lose access immediately.",
      stepUp: true, // require fresh 2FA — see security.stepUpVerify
      run: async ({ row, db }) => {
        await db.update(users).set({ status: "canceled" }).where(eq(users.id, row.id));
      },
    },
  },
  drawer: "userActivity", // key into top-level drawers map
  realtime: true, // pg LISTEN users_changed — opt-in per resource
});

const jobResource = defineResource(jobs, {
  label: "Job",
  labelPlural: "Jobs",
  columns: (j) => [
    j.title,
    j.platform,
    j.category, // relation — auto-rendered as category.name
    j.priceUsd,
    j.postedAt,
    j.archived,
  ],
  filters: (j) => [
    j.platform,
    j.category, // FK filter becomes category picker
    j.postedAt,
    j.archived,
  ],
  defaultSort: { field: "postedAt", dir: "desc" },
  realtime: true,
});

const paymentResource = defineResource(payments, {
  label: "Payment",
  columns: (p) => [p.id, p.user, p.amountRub, p.status, p.ukassaId, p.paidAt],
  filters: (p) => [p.status, p.createdAt],
  defaultSort: { field: "createdAt", dir: "desc" },
  actions: {
    refund: {
      type: "row",
      label: "Refund",
      icon: "undo",
      confirm: ({ row }) => `Refund ₽${(row.amountRub / 100).toFixed(2)} to ${row.user?.email}?`,
      stepUp: true,
      disabled: ({ row }) => row.status !== "succeeded",
      run: async ({ row, db }) => {
        await refundUkassaPayment(row.ukassaId);
        await db.update(payments).set({ status: "refunded" }).where(eq(payments.id, row.id));
      },
    },
  },
});

const aiCostResource = defineResource(aiCosts, {
  label: "AI cost",
  columns: (c) => [
    c.id,
    c.user,
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

// ─── Drawers ──────────────────────────────────────────────────────────────

const userActivity = defineDrawer({
  load: async ({ id, db }) => {
    const [user, lastPayment, spend7d] = await Promise.all([
      db.query.users.findFirst({ where: eq(users.id, Number(id)) }),
      db.query.payments.findFirst({
        where: eq(payments.userId, Number(id)),
        orderBy: [desc(payments.createdAt)],
      }),
      db
        .select({ sum: sum(aiCosts.costUsd) })
        .from(aiCosts)
        .where(
          and(
            eq(aiCosts.userId, Number(id)),
            gte(aiCosts.createdAt, sql`now() - interval '7 days'`),
          ),
        )
        .then((r) => Number(r[0]?.sum ?? 0)),
    ]);
    return { user, lastPayment, spend7d };
  },
  title: ({ data }) => data.user?.email ?? "User",
});

// ─── Pages ────────────────────────────────────────────────────────────────

const categoryPage = definePage({
  path: "categories",
  label: "Categories",
  group: "Admin",
  component: CategoryTreeEditor,
  access: ({ session }) => session.role === "admin",
});

const aiCostsDetailPage = definePage({
  path: "ai-costs-report",
  label: "AI spend report",
  group: "Reports",
  component: AiCostsDetailPage,
});

// ─── Root config ──────────────────────────────────────────────────────────

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

  drawers: { userActivity },

  pages: [categoryPage, aiCostsDetailPage],

  tabs: [
    { id: "dashboard", label: "Overview" },
    { id: "revenue", label: "Revenue" },
  ],

  // Dashboard: 5 widgets total, 3 of them realtime
  widgets: {
    mrr: w.metric({
      label: "MRR",
      format: "currency:rub",
      realtime: true,
      query: (db) =>
        db
          .select({ value: sum(payments.amountRub) })
          .from(payments)
          .where(
            and(
              eq(payments.status, "succeeded"),
              gte(payments.paidAt, sql`now() - interval '30 days'`),
            ),
          ),
    }),
    activeUsers: w.metric({
      label: "Active users (24h)",
      realtime: true,
      query: (db) =>
        db
          .selectDistinct({ value: sql<number>`count(distinct ${aiCosts.userId})` })
          .from(aiCosts)
          .where(gte(aiCosts.createdAt, sql`now() - interval '1 day'`)),
    }),
    aiSpend: w.chart({
      label: "AI spend by provider (7d)",
      kind: "bar",
      window: { size: "1 day", range: "7 days" },
      by: "provider",
      query: (db) =>
        db
          .select({
            bucket: sql<string>`date_trunc('day', ${aiCosts.createdAt})`,
            provider: aiCosts.provider,
            value: sum(aiCosts.costUsd),
          })
          .from(aiCosts)
          .where(gte(aiCosts.createdAt, sql`now() - interval '7 days'`))
          .groupBy(sql`1, 2`),
    }),
    recentPayments: w.table({
      label: "Latest payments",
      resource: "payment",
      limit: 5,
      sort: { field: "createdAt", dir: "desc" },
      realtime: true,
    }),
    subscriptionBreakdown: w.kv({
      label: "Subscription mix",
      query: (db) =>
        db
          .select({ plan: users.plan, count: sql<number>`count(*)` })
          .from(users)
          .where(eq(users.status, "active"))
          .groupBy(users.plan),
    }),
  },

  // Theme: only overrides that differ from the default preset.
  theme: {
    preset: "slate",
    colorScheme: "dark",
    tokens: {
      brand: "#f97316", // freelance-radar accent
    },
  },

  security: {
    auth: {
      getSession,
    },
    rowLevel: {
      // Admins see everything; regular staff are scoped to users they manage.
      users: ({ session }) => (session.role === "admin" ? undefined : eq(users.id, session.id)),
    },
    stepUpVerify: ({ action }) => action.stepUp === true,
  },
});
