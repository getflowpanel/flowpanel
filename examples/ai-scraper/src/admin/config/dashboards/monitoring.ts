import { dashboard, metric, table } from "@flowpanel/kit";
import { barChart } from "@flowpanel/kit/charts";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import * as schema from "@/src/db/schema";
import { modelLabel } from "@/src/lib/ai-models";
import { countInRange } from "../metrics";

export const monitoring = dashboard({
  path: "/monitoring",
  label: "Monitoring",
  dateRange: { preset: "last30d" },
  sections: [
    {
      // DB-derived from run history — reads true without Redis (unlike BullMQ job counts).
      label: "Crawl health",
      columns: 3,
      widgets: [
        metric("Runs", countInRange(schema.runs, schema.runs.startedAt)),
        metric("Failed runs", async ({ db, dateRange }) => {
          const rows = await db
            .select({ c: sql<number>`count(*)::int` })
            .from(schema.runs)
            .where(
              and(
                eq(schema.runs.status, "failed"),
                gte(schema.runs.startedAt, dateRange.from),
                lte(schema.runs.startedAt, dateRange.to),
              ),
            );
          return Number(rows[0]?.c ?? 0);
        }),
        metric("Listings found", async ({ db, dateRange }) => {
          const rows = await db
            .select({ s: sql<number>`coalesce(sum(${schema.runs.itemsExtracted}), 0)::int` })
            .from(schema.runs)
            .where(
              and(
                gte(schema.runs.startedAt, dateRange.from),
                lte(schema.runs.startedAt, dateRange.to),
              ),
            );
          return Number(rows[0]?.s ?? 0);
        }),
      ],
    },
    {
      label: "AI spend",
      columns: 1,
      widgets: [
        // cents → $ for the currency formatter.
        barChart(
          "AI cost by model",
          async ({ db, dateRange }) => {
            const rows = await db
              .select({
                model: schema.aiUsage.model,
                cost: sql<number>`sum(${schema.aiUsage.costCents})::float / 100`,
              })
              .from(schema.aiUsage)
              .where(
                and(
                  gte(schema.aiUsage.createdAt, dateRange.from),
                  lte(schema.aiUsage.createdAt, dateRange.to),
                ),
              )
              .groupBy(schema.aiUsage.model)
              .orderBy(sql`sum(${schema.aiUsage.costCents}) desc`);
            return rows.map((r) => ({ model: modelLabel(r.model), cost: r.cost }));
          },
          { x: "model", y: "cost", format: "currency", height: 220 },
        ),
      ],
    },
    {
      label: "Recent runs",
      columns: 1,
      widgets: [table({ resource: "runs", limit: 10, realtime: "resource.runs" })],
    },
  ],
});
