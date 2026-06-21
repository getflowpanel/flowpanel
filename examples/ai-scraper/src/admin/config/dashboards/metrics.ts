import type { WidgetContext } from "@flowpanel/kit";
import { type AnyColumn, and, gte, lte, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

/** Count rows of `table` whose `date` column falls in the dashboard's range. */
export const countInRange =
  (table: PgTable, date: AnyColumn) =>
  async ({ db, dateRange }: WidgetContext): Promise<number> => {
    const rows = await db
      .select({ c: sql<number>`count(*)::int` })
      .from(table)
      .where(and(gte(date, dateRange.from), lte(date, dateRange.to)));
    return Number(rows[0]?.c ?? 0);
  };
