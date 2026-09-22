import type { BarRow, FunnelStep, ListRow, StatValue, WidgetContext } from "@flowpanel/kit";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import type { AdminSession } from "@/src/demo/auth/session";
import { requireSandboxId } from "@/src/demo/sandbox/scope";

type Ctx = WidgetContext<typeof db>;

const sandboxIdFor = (ctx: Ctx) => requireSandboxId(ctx.session as AdminSession | null);

export async function offersByMarketplace(ctx: Ctx): Promise<BarRow[]> {
  const rows = await ctx.db
    .select({ site: schema.listings.site, count: sql<number>`count(*)::int` })
    .from(schema.listings)
    .where(
      and(
        eq(schema.listings.sandboxId, sandboxIdFor(ctx)),
        gte(schema.listings.scrapedAt, ctx.dateRange.from),
        lte(schema.listings.scrapedAt, ctx.dateRange.to),
      ),
    )
    .groupBy(schema.listings.site)
    .orderBy(desc(sql`count(*)`))
    .limit(5);

  return rows.map((row) => ({
    label: row.site,
    value: Number(row.count),
    href: ctx.href("listings", undefined, { filter: { site: row.site } }),
  }));
}

export async function matchPipeline(ctx: Ctx): Promise<FunnelStep[]> {
  const { from, to } = ctx.dateRange;
  const [offers, matched] = await Promise.all([
    ctx.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.listings)
      .where(
        and(
          eq(schema.listings.sandboxId, sandboxIdFor(ctx)),
          gte(schema.listings.scrapedAt, from),
          lte(schema.listings.scrapedAt, to),
        ),
      ),
    ctx.db
      .select({ status: schema.matches.status, count: sql<number>`count(*)::int` })
      .from(schema.matches)
      .where(
        and(
          eq(schema.matches.sandboxId, sandboxIdFor(ctx)),
          gte(schema.matches.matchedAt, from),
          lte(schema.matches.matchedAt, to),
        ),
      )
      .groupBy(schema.matches.status),
  ]);

  const byStatus = new Map(matched.map((row) => [row.status, Number(row.count)]));
  const total = matched.reduce((sum, row) => sum + Number(row.count), 0);
  return [
    { label: "Offers found", value: Number(offers[0]?.count ?? 0), href: ctx.href("listings") },
    { label: "AI matched", value: total, href: ctx.href("matches") },
    {
      label: "Confirmed",
      value: byStatus.get("confirmed") ?? 0,
      href: ctx.href("matches", undefined, { filter: { status: "confirmed" } }),
    },
  ];
}

export async function failingCrawls(ctx: Ctx): Promise<ListRow[]> {
  const rows = await ctx.db
    .select({
      id: schema.runs.id,
      monitor: schema.monitors.name,
      error: schema.runs.error,
      startedAt: schema.runs.startedAt,
    })
    .from(schema.runs)
    .innerJoin(
      schema.monitors,
      and(
        eq(schema.monitors.sandboxId, schema.runs.sandboxId),
        eq(schema.monitors.id, schema.runs.monitorId),
      ),
    )
    .where(and(eq(schema.runs.sandboxId, sandboxIdFor(ctx)), eq(schema.runs.status, "failed")))
    .orderBy(desc(schema.runs.startedAt))
    .limit(5);

  return rows.map((row) => ({
    text: row.monitor,
    meta: row.error ?? "unknown error",
    tone: "err" as const,
    href: ctx.href("runs", row.id),
  }));
}

/** Metered AI cost for the period, in dollars — one read-only statement. */
export async function aiSpendDollars(ctx: Ctx): Promise<StatValue> {
  const [row] = await ctx.sql<{ cents: number }>`
    select coalesce(sum(cost_cents), 0)::int as cents
    from ai_usage
    where sandbox_id = ${sandboxIdFor(ctx)}
      and created_at >= ${ctx.dateRange.from}
      and created_at <= ${ctx.dateRange.to}
  `;
  return Number(row?.cents ?? 0) / 100;
}
