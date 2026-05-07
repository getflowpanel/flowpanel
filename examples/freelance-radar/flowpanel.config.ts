import { gte, sql } from "drizzle-orm";
import { dashboard, defineAdmin, metric, resource, table } from "flowpanel";
import { areaChart } from "flowpanel/charts";
import { drizzleAdapter } from "flowpanel/drizzle";
import { headers } from "next/headers";
import { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import { type AdminSession, getSession } from "@/src/lib/auth";

declare module "@flowpanel/core" {
  interface FlowpanelTypes {
    db: typeof db;
  }
}

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
      delete: { softDelete: "deletedAt" },
      export: {
        formats: ["csv", "json"],
        fields: ["id", "email", "plan", "status", "createdAt"],
      },
      drawer: {
        width: "lg",
        header: (u: any) => String(u.email),
        fields: "*",
        actions: [
          {
            key: "disable",
            label: "Disable user",
            variant: "destructive",
            confirm: "Disable this user? They'll lose access immediately.",
            run: async (row, _input, _ctx) => {
              // Showcase action: pretends to issue an UPDATE. Real config
              // would use ctx.db + drizzle update — kept simple here to
              // avoid coupling the showcase to the seeding flow.
              const u = row as { email?: string };
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
    }),
    resource(schema.jobs, {
      label: "Jobs",
      columns: ["title", "platform", "priceUsd", "postedAt", "archived"],
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
      export: {
        formats: ["csv"],
        fields: ["id", "title", "platform", "priceUsd", "postedAt"],
      },
    }),
    resource(schema.payments, {
      label: "Payments",
      columns: ["userId", "amountRub", "status", "createdAt"],
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
    }),
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
          widgets: [table({ resource: "users", limit: 10, rowClick: "drawer" })],
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
