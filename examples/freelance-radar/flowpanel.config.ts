import { dashboard, defineAdmin, metric, queue, resource, table } from "@flowpanel/kit";
import { areaChart, barChart } from "@flowpanel/kit/charts";
import { drizzleAdapter } from "@flowpanel/kit/drizzle";
import { eq, gte, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { createElement } from "react";
import { PriorityMetricCard } from "@/src/admin/PriorityMetricCard";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import { type AdminSession, getSession } from "@/src/lib/auth";
import { queuesMap } from "@/src/lib/queues";

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
  }
}

/**
 * DEMO_MODE — when `process.env.DEMO_MODE === "true"`, every write path is
 * neutralized so a public instance survives Reddit traffic without vandalism.
 * - Row actions get a `disabled` tooltip ("Read-only in public demo").
 * - `create` / `update` / `delete` (incl. softDelete) are flagged `disabled`.
 * - A banner in `app/layout.tsx` tells visitors what they're looking at.
 * Data is restored periodically by `scripts/reset-demo.ts`.
 */
const DEMO_MODE = process.env.DEMO_MODE === "true";
const demoLock = DEMO_MODE ? "Read-only — public demo" : false;
const demoWriteOptions = DEMO_MODE
  ? ({
      create: { disabled: true },
      update: { disabled: true },
      delete: { disabled: true },
    } as const)
  : ({} as const);
const userDeleteOptions = DEMO_MODE
  ? ({ disabled: true } as const)
  : ({ softDelete: "deletedAt" } as const);

// --- Cell formatters (run server-side; no client hooks/handlers) ---------
const rub = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** Kopecks → ₽ (amounts are stored as integer kopecks). */
const formatRub = (kopecks: number | null | undefined) =>
  kopecks == null ? "—" : rub.format(kopecks / 100);
/** Cents → $ (AI costs are stored as integer cents). */
const formatUsdCents = (cents: number | null | undefined) =>
  cents == null ? "—" : usd.format(cents / 100);
/** Human-readable timestamp, or an em dash for null. */
const formatDate = (value: Date | string | null | undefined) =>
  value == null ? "—" : dateTime.format(new Date(value));

/** Tone-mapped pill for an enum status (server-side; inline styles so it
 *  renders regardless of the host's Tailwind content globs). */
const NEUTRAL_TONE = { bg: "rgba(113,113,122,0.18)", fg: "rgb(161,161,170)" };
const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  succeeded: { bg: "rgba(16,185,129,0.15)", fg: "rgb(52,211,153)" },
  pending: { bg: "rgba(245,158,11,0.16)", fg: "rgb(251,191,36)" },
  refunded: NEUTRAL_TONE,
  canceled: { bg: "rgba(244,63,94,0.15)", fg: "rgb(251,113,133)" },
};
const statusBadge = (status: string | null | undefined) => {
  if (!status) return "—";
  const tone = STATUS_TONES[status] ?? NEUTRAL_TONE;
  return createElement(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "999px",
        padding: "2px 8px",
        fontSize: "12px",
        fontWeight: 500,
        textTransform: "capitalize",
        background: tone.bg,
        color: tone.fg,
      },
    },
    status,
  );
};

export default defineAdmin({
  adapter: drizzleAdapter({ db, schema }),
  realtime: { driver: "memory" },
  auth: {
    session: async () => {
      const h = await headers();
      const s = await getSession(new Request("http://flowpanel.local/", { headers: h }));
      return s ? { ...s } : null;
    },
    role: (s) => (s as AdminSession | null)?.role ?? "guest",
    requireRole: "admin",
  },
  // Embedded mode: the host's app/layout.tsx already provides a top header
  // with the product brand. FlowPanel only contributes the tab strip + the
  // content beneath it. Set `shell: "sidebar"` for a standalone admin and
  // `shell: "bare"` to drop chrome entirely.
  shell: { mode: "tabs", brand: false },
  theme: {
    // L2 customization showcase: wrap the default MetricCard with a tone ring.
    components: { MetricCard: PriorityMetricCard },
  },
  // i18n showcase: localize built-in chrome to Russian.
  labels: {
    actions: { save: "Сохранить", cancel: "Отмена", delete: "Удалить" },
    bulkBar: { selected: "{n} выбрано", clear: "Очистить" },
    pagination: { previous: "Назад", next: "Вперёд", of: "из", rowsPerPage: "Строк на странице" },
    noResults: "Ничего не найдено",
    confirm: { ok: "Подтвердить", cancel: "Отмена" },
  },
  resources: [
    resource(schema.users, {
      label: "Users",
      columns: [
        "email",
        "plan",
        "status",
        { field: "createdAt", label: "Joined", render: (u) => formatDate(u.createdAt) },
      ],
      search: ["email", "telegramId"],
      filters: [
        {
          field: "plan",
          type: "select",
          label: "Plan",
          options: [
            { label: "Free", value: "free" },
            { label: "Pro", value: "pro" },
            { label: "Team", value: "team" },
          ],
        },
        {
          field: "status",
          type: "select",
          label: "Status",
          options: [
            { label: "Active", value: "active" },
            { label: "Trialing", value: "trialing" },
            { label: "Past due", value: "past_due" },
            { label: "Canceled", value: "canceled" },
          ],
        },
        { field: "createdAt", type: "daterange", label: "Joined" },
      ],
      defaultSort: { field: "createdAt", dir: "desc" },
      rowClick: "drawer",
      realtime: true,
      delete: userDeleteOptions,
      ...(DEMO_MODE ? { create: { disabled: true }, update: { disabled: true } } : {}),
      export: {
        formats: ["csv", "json"],
        fields: ["id", "email", "plan", "status", "createdAt"],
      },
      drawer: {
        width: "lg",
        header: (u) => String((u as typeof schema.users.$inferSelect).email),
        fields: "*",
        actions: [
          {
            key: "disable",
            label: "Disable user",
            variant: "destructive",
            confirm: "Disable this user? They'll lose access immediately.",
            ...(demoLock ? { disabled: () => demoLock } : {}),
            run: async (row, _input, ctx) => {
              if (DEMO_MODE) {
                return { ok: false, error: "Demo mode — actions are disabled" };
              }
              const u = row as { id: number; email?: string };
              await ctx.db
                .update(schema.users)
                .set({ deletedAt: new Date() })
                .where(eq(schema.users.id, u.id));
              return {
                ok: true,
                message: `Disabled ${u.email ?? "user"}`,
                refresh: true,
              };
            },
          },
        ],
      },
    }),
    resource(schema.categories, {
      label: "Categories",
      columns: ["name", "slug", "parentId", "createdAt"],
      search: ["name", "slug"],
      ...demoWriteOptions,
    }),
    resource(schema.jobs, {
      label: "Jobs",
      columns: [
        "title",
        "platform",
        {
          field: "categoryId",
          label: "Category",
          reference: { resource: "categories", labelField: "name" },
        },
        "priceUsd",
        { field: "postedAt", label: "Posted", render: (j) => formatDate(j.postedAt) },
        "archived",
      ],
      search: ["title", "description"],
      filters: [
        {
          field: "platform",
          type: "select",
          label: "Platform",
          options: [
            { label: "Upwork", value: "upwork" },
            { label: "FL.ru", value: "fl_ru" },
            { label: "Kwork", value: "kwork" },
            { label: "Telegram", value: "telegram" },
            { label: "LinkedIn", value: "linkedin" },
          ],
        },
        { field: "archived", type: "boolean", label: "Archived" },
        { field: "postedAt", type: "daterange", label: "Posted" },
      ],
      defaultSort: { field: "postedAt", dir: "desc" },
      ...demoWriteOptions,
      export: {
        formats: ["csv"],
        fields: ["id", "title", "platform", "priceUsd", "postedAt"],
      },
    }),
    resource(schema.payments, {
      label: "Payments",
      columns: [
        {
          field: "userId",
          label: "User",
          reference: { resource: "users", labelField: "email" },
        },
        {
          field: "amountRub",
          label: "Amount",
          align: "right",
          render: (p) => formatRub(p.amountRub),
        },
        { field: "status", label: "Status", render: (p) => statusBadge(p.status) },
        { field: "createdAt", label: "Created", render: (p) => formatDate(p.createdAt) },
      ],
      filters: [
        {
          field: "status",
          type: "select",
          label: "Status",
          options: [
            { label: "Pending", value: "pending" },
            { label: "Succeeded", value: "succeeded" },
            { label: "Canceled", value: "canceled" },
            { label: "Refunded", value: "refunded" },
          ],
        },
        { field: "amountRub", type: "numeric-range", label: "Amount (Rub)" },
      ],
      defaultSort: { field: "createdAt", dir: "desc" },
      ...demoWriteOptions,
    }),
    resource(schema.aiCosts, {
      label: "AI costs",
      columns: [
        {
          field: "userId",
          label: "User",
          reference: { resource: "users", labelField: "email" },
        },
        "provider",
        "model",
        { field: "tokensIn", label: "Tokens in", align: "right" },
        { field: "tokensOut", label: "Tokens out", align: "right" },
        {
          field: "costUsd",
          label: "Cost",
          align: "right",
          render: (c) => formatUsdCents(c.costUsd),
        },
        { field: "createdAt", label: "Created", render: (c) => formatDate(c.createdAt) },
      ],
      filters: [
        {
          field: "provider",
          type: "select",
          label: "Provider",
          options: [
            { label: "OpenAI", value: "openai" },
            { label: "Anthropic", value: "anthropic" },
            { label: "Gemini", value: "gemini" },
          ],
        },
        { field: "createdAt", type: "daterange", label: "Date" },
      ],
      defaultSort: { field: "createdAt", dir: "desc" },
      ...demoWriteOptions,
    }),
  ],
  queues: [
    ...(queuesMap.scraper
      ? [
          queue(queuesMap.scraper, {
            label: "Scraper",
            boardUrl: "http://localhost:3001/queues/scraper",
          }),
        ]
      : []),
    ...(queuesMap.emails
      ? [
          queue(queuesMap.emails, {
            label: "Emails",
            boardUrl: "http://localhost:3001/queues/emails",
          }),
        ]
      : []),
    ...(queuesMap.billing
      ? [
          queue(queuesMap.billing, {
            label: "Billing",
            boardUrl: "http://localhost:3001/queues/billing",
          }),
        ]
      : []),
  ],
  dashboards: [
    dashboard({
      path: "/",
      label: "Overview",
      dateRange: { preset: "last7d" },
      sections: [
        {
          label: "Today",
          columns: 4,
          widgets: [
            metric("Users", async ({ db }) => {
              const rows = await db.select({ c: sql<number>`count(*)::int` }).from(schema.users);
              return Number(rows[0]?.c ?? 0);
            }),
            metric("Jobs", async ({ db }) => {
              const rows = await db.select({ c: sql<number>`count(*)::int` }).from(schema.jobs);
              return Number(rows[0]?.c ?? 0);
            }),
            metric("Categories", async ({ db }) => {
              const rows = await db
                .select({ c: sql<number>`count(*)::int` })
                .from(schema.categories);
              return Number(rows[0]?.c ?? 0);
            }),
            metric("Payments", async ({ db }) => {
              const rows = await db.select({ c: sql<number>`count(*)::int` }).from(schema.payments);
              return Number(rows[0]?.c ?? 0);
            }),
          ],
        },
        {
          label: "Signups",
          columns: 1,
          widgets: [
            areaChart(
              "Signups",
              async ({ db, dateRange }) => {
                const rows = await db
                  .select({
                    day: sql<string>`date_trunc('day', ${schema.users.createdAt})`,
                    count: sql<number>`count(*)::int`,
                  })
                  .from(schema.users)
                  .where(gte(schema.users.createdAt, dateRange.from))
                  .groupBy(sql`date_trunc('day', ${schema.users.createdAt})`)
                  .orderBy(sql`date_trunc('day', ${schema.users.createdAt})`);
                return rows as unknown[];
              },
              { x: "day", y: "count", smooth: true, height: 220 },
            ),
          ],
        },
        {
          label: "Recent users",
          columns: 1,
          widgets: [
            table({ resource: "users", limit: 10, rowClick: "drawer", realtime: "resource.users" }),
          ],
        },
      ],
    }),
    dashboard({
      path: "/monitoring",
      label: "Monitoring",
      sections: [
        {
          label: "Queue health",
          columns: 3,
          widgets: [
            metric("Scraper active", async () => {
              if (!queuesMap.scraper) return 0;
              const counts = await queuesMap.scraper.getJobCounts("active");
              return Number(counts.active ?? 0);
            }),
            metric("Emails waiting", async () => {
              if (!queuesMap.emails) return 0;
              const counts = await queuesMap.emails.getJobCounts("waiting");
              return Number(counts.waiting ?? 0);
            }),
            metric("Billing failed", async () => {
              if (!queuesMap.billing) return 0;
              const counts = await queuesMap.billing.getJobCounts("failed");
              return Number(counts.failed ?? 0);
            }),
          ],
        },
        {
          label: "AI spend",
          columns: 1,
          widgets: [
            barChart(
              "AI cost by provider",
              async ({ db }) => {
                const rows = await db
                  .select({
                    provider: schema.aiCosts.provider,
                    // cents → dollars so the currency formatter shows $.
                    cost: sql<number>`sum(${schema.aiCosts.costUsd})::float / 100`,
                  })
                  .from(schema.aiCosts)
                  .groupBy(schema.aiCosts.provider)
                  .orderBy(sql`sum(${schema.aiCosts.costUsd}) desc`);
                return rows as unknown[];
              },
              { x: "provider", y: "cost", format: "currency", height: 220 },
            ),
          ],
        },
        {
          label: "Recent jobs",
          columns: 1,
          widgets: [
            table({ resource: "jobs", limit: 10, rowClick: "drawer", realtime: "resource.jobs" }),
          ],
        },
      ],
    }),
  ],
  commandPalette: {
    groups: [
      {
        label: "Actions",
        items: [{ label: "Open Overview", action: { type: "navigate", href: "/admin" } }],
      },
    ],
  },
});
