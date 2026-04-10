import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { FlowPanelContext } from "../context.js";

// Allows plain identifiers (users) and schema-qualified names (public.users)
function assertSafeIdentifier(value: string, name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(value)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Invalid identifier "${name}": ${value}`,
    });
  }
}

export function createUsersProcedures(
  t: { procedure: any; router: (routes: any) => any },
  authedProcedure: any,
) {
  return t.router({
    list: authedProcedure
      .input(
        z.object({
          cursor: z.string().optional(),
          limit: z.number().min(1).max(200).default(50),
          search: z.string().optional(),
        }),
      )
      .query(async ({ ctx, input }: { ctx: FlowPanelContext & { session: any }; input: any }) => {
        const { db, config } = ctx;

        if (!(config as any).users) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "users not configured in flowpanel.config.ts",
          });
        }

        const { source, primaryKey, columns = [], periodStart, periodEnd } = (config as any).users;
        assertSafeIdentifier(source, "source");
        assertSafeIdentifier(primaryKey, "primaryKey");
        if (periodStart) assertSafeIdentifier(periodStart, "periodStart");
        if (periodEnd) assertSafeIdentifier(periodEnd, "periodEnd");
        const userCols = columns.map((c: any) => c.field).filter((f: string) => !f.startsWith("$"));
        for (const col of userCols) assertSafeIdentifier(col, `column "${col}"`);

        const selectCols = userCols.length > 0 ? userCols.join(", ") : "*";
        const params: unknown[] = [];
        const whereParts: string[] = [];

        if (input.cursor) {
          whereParts.push(`${primaryKey} > $${params.length + 1}`);
          params.push(input.cursor);
        }
        if (input.search) {
          whereParts.push(`email ILIKE $${params.length + 1}`);
          params.push(`%${input.search}%`);
        }

        const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";

        const computedCols = columns
          .filter((c: any) => c.field.startsWith("$"))
          .map((c: any) => c.field);
        const lateralClauses: string[] = [];

        if (computedCols.includes("$runs24h")) {
          lateralClauses.push(
            `(SELECT COUNT(*) FROM flowpanel_pipeline_run WHERE partition_key = u.${primaryKey}::text AND started_at > now() - INTERVAL '24 hours') AS runs_24h`,
          );
        }
        if (computedCols.includes("$lastActive")) {
          lateralClauses.push(
            `(SELECT MAX(started_at) FROM flowpanel_pipeline_run WHERE partition_key = u.${primaryKey}::text) AS last_active`,
          );
        }
        if (computedCols.includes("$aiSpendMtd") && periodStart && periodEnd) {
          lateralClauses.push(
            `(SELECT COALESCE(SUM(cost_usd), 0) FROM flowpanel_ai_usage_daily WHERE partition_key = u.${primaryKey}::text AND day >= u.${periodStart} AND day < u.${periodEnd}) AS ai_spend_mtd`,
          );
        }

        const extraSelect = lateralClauses.length > 0 ? `, ${lateralClauses.join(", ")}` : "";

        const rows = await db.execute<Record<string, unknown>>(
          `SELECT u.${selectCols}${extraSelect}
           FROM ${source} u
           ${whereClause}
           ORDER BY u.${primaryKey}
           LIMIT $${params.length + 1}`,
          [...params, input.limit + 1],
        );

        const hasNext = rows.length > input.limit;
        const data = hasNext ? rows.slice(0, input.limit) : rows;
        const nextCursor = hasNext ? String(data[data.length - 1]?.[primaryKey]) : null;

        return { data, nextCursor };
      }),

    get: authedProcedure
      .input(z.object({ userId: z.string() }))
      .query(async ({ ctx, input }: { ctx: FlowPanelContext & { session: any }; input: any }) => {
        const { db, config } = ctx;
        if (!(config as any).users) throw new TRPCError({ code: "BAD_REQUEST" });

        const { source, primaryKey } = (config as any).users;
        assertSafeIdentifier(source, "source");
        assertSafeIdentifier(primaryKey, "primaryKey");
        const rows = await db.execute<Record<string, unknown>>(
          `SELECT * FROM ${source} WHERE ${primaryKey} = $1 LIMIT 1`,
          [input.userId],
        );
        if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
        return rows[0];
      }),
  });
}
