import { custom, dashboard, metric } from "@flowpanel/kit";
import { areaChart, barChart, pieChart } from "@flowpanel/kit/charts";
import { and, gte, lte, sql } from "drizzle-orm";
import { LiveFeed } from "@/src/admin/LiveFeed";
import { LiveStats } from "@/src/admin/LiveStats";
import * as schema from "@/src/db/schema";
import { getLiveStats, getRecentEvents } from "@/src/lib/live-feed";
import { countInRange } from "./metrics";

export const overview = dashboard({
  path: "/",
  label: "Overview",
  dateRange: { preset: "last7d" },
  sections: [
    {
      label: "Activity",
      columns: 4,
      widgets: [
        metric("New customers", countInRange(schema.users, schema.users.createdAt)),
        metric("Listings tracked", countInRange(schema.listings, schema.listings.scrapedAt)),
        metric("AI matches", countInRange(schema.matches, schema.matches.matchedAt)),
        metric("Runs", countInRange(schema.runs, schema.runs.startedAt)),
      ],
    },
    {
      // In-memory ticker → SSE → these widgets; no DB reads (src/lib/live-feed.ts).
      label: "Live",
      columns: 1,
      widgets: [
        custom(LiveStats, async () => ({ initial: getLiveStats() }), { frame: false }),
        custom(LiveFeed, async () => ({ recent: getRecentEvents() }), { frame: false }),
      ],
    },
    {
      label: "AI quality",
      columns: 2,
      widgets: [
        pieChart(
          "Match status",
          async ({ db, dateRange }) => {
            const rows = await db
              .select({
                status: schema.matches.status,
                count: sql<number>`count(*)::int`,
              })
              .from(schema.matches)
              .where(
                and(
                  gte(schema.matches.matchedAt, dateRange.from),
                  lte(schema.matches.matchedAt, dateRange.to),
                ),
              )
              .groupBy(schema.matches.status);
            return rows;
          },
          {
            category: "status",
            value: "count",
            donut: true,
            showLegend: true,
            height: 280,
            colors: {
              confirmed: "hsl(158 42% 48%)",
              needs_review: "hsl(40 68% 56%)",
              rejected: "hsl(353 50% 61%)",
            },
          },
        ),
        barChart(
          "Confidence by model",
          async ({ db, dateRange }) => {
            const rows = await db
              .select({
                model: schema.matches.model,
                confidence: sql<number>`round(avg(${schema.matches.confidence})::numeric * 100, 0)::float`,
              })
              .from(schema.matches)
              .where(
                and(
                  gte(schema.matches.matchedAt, dateRange.from),
                  lte(schema.matches.matchedAt, dateRange.to),
                ),
              )
              .groupBy(schema.matches.model)
              .orderBy(sql`avg(${schema.matches.confidence}) desc`);
            return rows;
          },
          { x: "model", y: "confidence", height: 280 },
        ),
      ],
    },
    {
      label: "Growth",
      columns: 1,
      widgets: [
        // Cumulative signups (running sum) — a smooth growth curve at any volume.
        areaChart(
          "Customer growth",
          async ({ db }) => {
            const daily = await db
              .select({
                // Pre-format to a compact "Jun 7" label — format-tick only
                // re-parses ISO-like strings, so it passes through as-is.
                day: sql<string>`to_char(date_trunc('day', ${schema.users.createdAt}), 'Mon FMDD')`,
                c: sql<number>`count(*)::int`,
              })
              .from(schema.users)
              .groupBy(sql`date_trunc('day', ${schema.users.createdAt})`)
              .orderBy(sql`date_trunc('day', ${schema.users.createdAt})`);
            let total = 0;
            const cumulative = daily.map((d) => {
              total += Number(d.c);
              return { day: d.day, count: total };
            });
            return cumulative.slice(-30);
          },
          { x: "day", y: "count", smooth: true, height: 220 },
        ),
      ],
    },
  ],
});
