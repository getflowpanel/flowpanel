import type { WidgetContext } from "@flowpanel/kit";
import { type AnyColumn, and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import type { ReviewQueueProps } from "@/src/admin/ReviewQueue";
import type { db } from "@/src/db/client";
import * as schema from "@/src/db/schema";
import type { AdminSession } from "@/src/demo/auth/session";
import { requireSandboxId } from "@/src/demo/sandbox/scope";

type QueryContext = WidgetContext<typeof db>;

const inRange = (column: AnyColumn, { from, to }: QueryContext["dateRange"]) =>
  and(gte(column, from), lte(column, to));
const sandboxIdFor = (context: QueryContext) =>
  requireSandboxId(context.session as AdminSession | null);

export async function activeMonitorCount(context: QueryContext): Promise<number> {
  const { db } = context;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.monitors)
    .where(
      and(
        eq(schema.monitors.sandboxId, sandboxIdFor(context)),
        eq(schema.monitors.status, "active"),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function offersDiscovered(context: QueryContext): Promise<number> {
  const { db, dateRange } = context;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.listings)
    .where(
      and(
        eq(schema.listings.sandboxId, sandboxIdFor(context)),
        inRange(schema.listings.scrapedAt, dateRange),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function crawlSuccessRate(context: QueryContext): Promise<string> {
  const { db, dateRange } = context;
  const [row] = await db
    .select({
      completed: sql<number>`count(*)::int`,
      successful: sql<number>`count(*) filter (where ${schema.runs.status} = 'success')::int`,
    })
    .from(schema.runs)
    .where(
      and(
        eq(schema.runs.sandboxId, sandboxIdFor(context)),
        inArray(schema.runs.status, ["success", "failed"]),
        inRange(schema.runs.startedAt, dateRange),
      ),
    );

  const completed = Number(row?.completed ?? 0);
  return completed === 0 ? "—" : `${Math.round((Number(row?.successful ?? 0) / completed) * 100)}%`;
}

export async function reviewBacklog(context: QueryContext): Promise<number> {
  const { db } = context;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.matches)
    .where(
      and(
        eq(schema.matches.sandboxId, sandboxIdFor(context)),
        eq(schema.matches.status, "needs_review"),
      ),
    );
  return Number(row?.count ?? 0);
}

export async function reviewQueueSummary(context: QueryContext): Promise<ReviewQueueProps> {
  const { db, dateRange } = context;
  const [pending, rows] = await Promise.all([
    reviewBacklog(context),
    db
      .select({ status: schema.matches.status, count: sql<number>`count(*)::int` })
      .from(schema.matches)
      .where(
        and(
          eq(schema.matches.sandboxId, sandboxIdFor(context)),
          inRange(schema.matches.matchedAt, dateRange),
        ),
      )
      .groupBy(schema.matches.status),
  ]);
  const counts = new Map(rows.map((row) => [row.status, Number(row.count)]));
  const total = rows.reduce((sum, row) => sum + Number(row.count), 0);
  const outcome = (status: "confirmed" | "needs_review" | "rejected", label: string) => {
    const count = counts.get(status) ?? 0;
    return {
      label,
      count,
      share: total === 0 ? 0 : Math.round((count / total) * 100),
      tone: status === "needs_review" ? ("warn" as const) : ("default" as const),
    };
  };

  return {
    pending,
    outcomes: [
      outcome("confirmed", "Confirmed"),
      outcome("needs_review", "Needs review"),
      outcome("rejected", "Rejected"),
    ],
  };
}
