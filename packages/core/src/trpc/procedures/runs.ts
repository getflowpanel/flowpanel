import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createQueryBuilder } from "../../queryBuilder.js";
import { fieldNameToColumn } from "../../schemaGenerator.js";
import type { Session } from "../../types/config.js";
import type { FlowPanelContext } from "../context.js";

interface RunRow {
  id: string;
  run_id: string;
  partition_key: string | null;
  stage: string;
  status: "running" | "succeeded" | "failed";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  error_class: string | null;
  error_message: string | null;
  [key: string]: unknown;
}

const listInputSchema = z.object({
  stage: z.string().optional(),
  status: z.enum(["running", "succeeded", "failed"]).optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(200).default(50),
  search: z.string().optional(),
  timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
});

const retryInputSchema = z.object({ runId: z.string() });
const bulkRetryInputSchema = z.object({
  runIds: z.array(z.string()).optional(),
  filter: z.object({ stage: z.string().optional(), status: z.string().optional() }).optional(),
  confirmText: z.string().optional(),
});
const cancelInputSchema = z.object({ runId: z.string() });

function applyRowLevelFilter(
  config: FlowPanelContext["config"],
  session: Session,
  whereParts: string[],
  params: unknown[],
) {
  const filter = (
    config.security.rowLevel?.filter as
      | ((session: Session, ctx: Record<string, unknown>) => { partitionKey?: string } | undefined)
      | undefined
  )?.(session, {});
  if (filter?.partitionKey) {
    whereParts.push(`partition_key = $${params.length + 1}`);
    params.push(filter.partitionKey);
  }
}

export function createRunsProcedures(
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  t: { procedure: any; router: (routes: any) => any },
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  authedProcedure: any,
) {
  return t.router({
    list: authedProcedure
      .input(listInputSchema)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof listInputSchema>;
        }) => {
          const { db, config, session } = ctx;
          const whereParts: string[] = [];
          const params: unknown[] = [];

          if (input.stage) {
            whereParts.push(`stage = $${params.length + 1}`);
            params.push(input.stage);
          }
          if (input.status) {
            whereParts.push(`status = $${params.length + 1}`);
            params.push(input.status);
          }
          if (input.timeRange) {
            whereParts.push(`started_at >= $${params.length + 1}`);
            params.push(input.timeRange.start);
            whereParts.push(`started_at < $${params.length + 1}`);
            params.push(input.timeRange.end);
          }
          if (input.search && input.search.length >= 2) {
            const searchFields = config.runLog?.search?.fields ?? [
              "partition_key",
              "error_message",
            ];
            const searchCols = searchFields.map((f: string) => fieldNameToColumn(f));
            const searchOr = searchCols
              .map((col: string) => `${col} ILIKE $${params.length + 1}`)
              .join(" OR ");
            whereParts.push(`(${searchOr})`);
            params.push(`%${input.search}%`);
          }

          if (input.cursor) {
            whereParts.push(`id < $${params.length + 1}`);
            params.push(BigInt(input.cursor));
          }

          applyRowLevelFilter(config, session, whereParts, params);

          const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(" AND ")}` : "";
          const limitParam = input.limit + 1;

          const rows = await db.execute<Record<string, unknown>>(
            `SELECT * FROM flowpanel_pipeline_run
           ${whereClause}
           ORDER BY id DESC
           LIMIT ${limitParam}`,
            params,
          );

          const hasNextPage = rows.length > input.limit;
          const data = hasNextPage ? rows.slice(0, input.limit) : rows;
          const nextCursor = hasNextPage ? String(data[data.length - 1]?.["id"]) : null;

          return { data, nextCursor };
        },
      ),

    get: authedProcedure
      .input(z.object({ runId: z.string() }))
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: { runId: string };
        }) => {
          const { db, config, session } = ctx;
          const whereParts = [`id = $1`];
          const params: unknown[] = [BigInt(input.runId)];
          applyRowLevelFilter(config, session, whereParts, params);

          const rows = await db.execute<Record<string, unknown>>(
            `SELECT * FROM flowpanel_pipeline_run WHERE ${whereParts.join(" AND ")} LIMIT 1`,
            params,
          );
          if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND" });
          return rows[0];
        },
      ),

    retry: authedProcedure
      .input(retryInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof retryInputSchema>;
        }) => {
          const { db, config, session } = ctx;

          if (!config.pipeline.onRetry) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Retry not configured. Add pipeline.onRetry to your flowpanel.config.ts",
            });
          }

          const rows = await db.execute<Record<string, unknown>>(
            `SELECT * FROM flowpanel_pipeline_run WHERE id = $1 AND status = 'failed' LIMIT 1`,
            [BigInt(input.runId)],
          );
          const run = rows[0];
          if (!run)
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Run not found or not in failed status",
            });

          const retryRun = await db.execute<{ id: bigint }>(
            `INSERT INTO flowpanel_pipeline_run (stage, status, retry_of_run_id, started_at)
           VALUES ($1, 'running', $2, now())
           RETURNING id`,
            [run["stage"], run["id"]],
          );

          await (config.pipeline.onRetry as (...args: unknown[]) => unknown)(
            {
              stage: run["stage"] as string,
              fields: run,
              errorClass: run["error_class"] as string | undefined,
              errorMessage: run["error_message"] as string | undefined,
            },
            { userId: session.userId, db },
          );

          return { retryRunId: String(retryRun[0]?.id) };
        },
      ),

    cancel: authedProcedure
      .input(cancelInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof cancelInputSchema>;
        }) => {
          const { db } = ctx;
          const updated = await db.execute<{ id: bigint }>(
            `UPDATE flowpanel_pipeline_run
           SET status = 'failed', finished_at = now(), error_class = 'CancelledByAdmin'
           WHERE id = $1 AND status = 'running'
           RETURNING id`,
            [BigInt(input.runId)],
          );
          if (!updated[0]) throw new TRPCError({ code: "NOT_FOUND" });
          return { cancelled: true };
        },
      ),

    bulkRetry: authedProcedure
      .input(bulkRetryInputSchema)
      .mutation(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: z.infer<typeof bulkRetryInputSchema>;
        }) => {
          const { db, config } = ctx;

          if (!config.pipeline.onRetry) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Retry not configured" });
          }

          let whereSql: string;
          let whereParams: unknown[];

          if (input.runIds) {
            if (
              input.runIds.length > 50 &&
              !input.confirmText?.includes(String(input.runIds.length))
            ) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Type "retry ${input.runIds.length}" to confirm bulk retry of ${input.runIds.length} runs`,
              });
            }
            whereSql = `id = ANY($1::bigint[]) AND status = 'failed'`;
            whereParams = [input.runIds.map(BigInt)];
          } else if (input.filter) {
            const parts = ["status = 'failed'"];
            whereParams = [];
            if (input.filter.stage) {
              parts.push(`stage = $${whereParams.length + 1}`);
              whereParams.push(input.filter.stage);
            }
            whereSql = parts.join(" AND ");
          } else {
            throw new TRPCError({ code: "BAD_REQUEST" });
          }

          const runs = await db.execute<Record<string, unknown>>(
            `SELECT * FROM flowpanel_pipeline_run WHERE ${whereSql}`,
            whereParams,
          );

          const results: { runId: string; success: boolean; error?: string }[] = [];
          for (const run of runs) {
            try {
              await (config.pipeline.onRetry as (...args: unknown[]) => unknown)(
                { stage: run["stage"] as string, fields: run },
                { userId: ctx.session.userId, db },
              );
              results.push({ runId: String(run["id"]), success: true });
            } catch (err) {
              results.push({ runId: String(run["id"]), success: false, error: String(err) });
            }
          }

          return { total: runs.length, results };
        },
      ),

    chart: authedProcedure
      .input(z.object({ timeRange: z.enum(["1h", "6h", "24h", "7d", "30d"]) }))
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: { timeRange: "1h" | "6h" | "24h" | "7d" | "30d" };
        }) => {
          const { db, config } = ctx;
          const qb = createQueryBuilder({
            stages: config.pipeline?.stages ?? [],
            stageFields: config.pipeline?.stageFields ?? {},
            fields: config.pipeline?.fields ?? {},
          });

          const queryDef = qb.chartBuckets(input.timeRange, db.dialect);
          const rows = await db.execute<Record<string, unknown>>(queryDef.sql, queryDef.params);

          const buckets = rows.map((row) => {
            const bucket = row["bucket"];
            let label = "";

            if (bucket instanceof Date || (typeof bucket === "string" && bucket.length > 0)) {
              const d = bucket instanceof Date ? bucket : new Date(bucket as string);
              if (!isNaN(d.getTime())) {
                if (input.timeRange === "30d") {
                  // "Jan 5"
                  label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                } else if (input.timeRange === "7d") {
                  // "Mon 03:00" or just "Mon" at midnight
                  const timeStr = d.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                  if (timeStr === "00:00") {
                    label = d.toLocaleDateString("en-US", { weekday: "short" });
                  } else {
                    label = `${d.toLocaleDateString("en-US", { weekday: "short" })} ${timeStr}`;
                  }
                } else {
                  // "03:00"
                  label = d.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
                }
              }
            }

            return {
              label,
              total: Number(row["total"] ?? 0),
              succeeded: Number(row["succeeded"] ?? 0),
              failed: Number(row["failed"] ?? 0),
            };
          });

          // Find peak bucket
          let peakBucket: { label: string; total: number } | null = null;
          for (const b of buckets) {
            if (!peakBucket || b.total > peakBucket.total) {
              peakBucket = { label: b.label, total: b.total };
            }
          }

          return { buckets, peakBucket };
        },
      ),

    topErrors: authedProcedure
      .input(
        z.object({
          timeRange: z.enum(["1h", "6h", "24h", "7d", "30d"]),
          limit: z.number().int().min(1).max(20).default(5),
        }),
      )
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: Session };
          input: { timeRange: "1h" | "6h" | "24h" | "7d" | "30d"; limit: number };
        }) => {
          const { db, config } = ctx;
          const qb = createQueryBuilder({
            stages: config.pipeline?.stages ?? [],
            stageFields: config.pipeline?.stageFields ?? {},
            fields: config.pipeline?.fields ?? {},
          });

          const errQuery = qb.where({ timeRange: input.timeRange }).topErrors(input.limit);
          const errors = await db.execute<{ error_class: string; count: number }>(
            errQuery.sql,
            errQuery.params,
          );

          const totalQuery = qb.where({ timeRange: input.timeRange, status: "failed" }).count();
          const [row] = await db.execute<{ value: number }>(totalQuery.sql, totalQuery.params);

          return {
            errors: errors.map((e) => ({ errorClass: e.error_class, count: e.count })),
            totalFailed: row?.value ?? 0,
          };
        },
      ),
  });
}
