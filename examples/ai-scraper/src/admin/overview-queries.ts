import type { WidgetContext } from "@flowpanel/kit";
import { type AnyColumn, and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";

type QueryContext = WidgetContext<typeof db>;

const inRange = (column: AnyColumn, { from, to }: QueryContext["dateRange"]) =>
  and(gte(column, from), lte(column, to));

export async function activeMonitorCount({ db }: QueryContext): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.monitors)
    .where(eq(schema.monitors.status, "active"));
  return Number(row?.count ?? 0);
}

export async function offersDiscovered({ db, dateRange }: QueryContext): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.listings)
    .where(inRange(schema.listings.scrapedAt, dateRange));
  return Number(row?.count ?? 0);
}

export async function crawlSuccessRate({ db, dateRange }: QueryContext): Promise<string> {
  const [row] = await db
    .select({
      completed: sql<number>`count(*)::int`,
      successful: sql<number>`count(*) filter (where ${schema.runs.status} = 'success')::int`,
    })
    .from(schema.runs)
    .where(
      and(
        inArray(schema.runs.status, ["success", "failed"]),
        inRange(schema.runs.startedAt, dateRange),
      ),
    );

  const completed = Number(row?.completed ?? 0);
  return completed === 0 ? "—" : `${Math.round((Number(row?.successful ?? 0) / completed) * 100)}%`;
}

export async function reviewBacklog({ db }: QueryContext): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.matches)
    .where(eq(schema.matches.status, "needs_review"));
  return Number(row?.count ?? 0);
}

export async function offersTrend({
  db,
  dateRange,
}: QueryContext): Promise<Array<{ day: string; offers: number }>> {
  const day = sql`date_trunc('day', ${schema.listings.scrapedAt})`;
  return db
    .select({
      day: sql<string>`to_char(${day}, 'Mon FMDD')`,
      offers: sql<number>`count(*)::int`,
    })
    .from(schema.listings)
    .where(inRange(schema.listings.scrapedAt, dateRange))
    .groupBy(day)
    .orderBy(day);
}

export async function matchQuality({
  db,
  dateRange,
}: QueryContext): Promise<Array<{ status: string; count: number }>> {
  return db
    .select({ status: schema.matches.status, count: sql<number>`count(*)::int` })
    .from(schema.matches)
    .where(
      and(
        gte(schema.matches.matchedAt, dateRange.from),
        lte(schema.matches.matchedAt, dateRange.to),
      ),
    )
    .groupBy(schema.matches.status)
    .orderBy(schema.matches.status);
}
