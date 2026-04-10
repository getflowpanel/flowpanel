import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { fieldNameToColumn } from "../../schemaGenerator.js";
import type { FlowPanelContext } from "../context.js";

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

const chartInputSchema = z.object({
  timeRange: z.enum(["1h", "6h", "24h", "7d", "30d"]),
});

const topErrorsInputSchema = z.object({
  timeRange: z.enum(["1h", "6h", "24h", "7d", "30d"]),
  limit: z.number().min(1).max(50).default(10).optional(),
});

function getIntervalSql(timeRange: string): string {
  const map: Record<string, string> = {
    "1h": "1 hour",
    "6h": "6 hours",
    "24h": "24 hours",
    "7d": "7 days",
    "30d": "30 days",
  };
  return map[timeRange] ?? "24 hours";
}

function applyRowLevelFilter(
  config: FlowPanelContext["config"],
  session: any,
  whereParts: string[],
  params: unknown[],
) {
  const filter = (config.security as any)?.rowLevel?.filter?.(session, {});
  if (filter?.partitionKey) {
    whereParts.push(`partition_key = $${params.length + 1}`);
    params.push(filter.partitionKey);
  }
}

export function createRunsProcedures(
  t: { procedure: any; router: (routes: any) => any },
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
          ctx: FlowPanelContext & { session: any };
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
            const rawSearchFields: string[] = (config as any).runLog?.search?.fields ?? [
              "partition_key",
              "error_message",
            ];
            const searchCols = rawSearchFields.map((f: string) => {
              const col = fieldNameToColumn(f);
              if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(col)) {
                throw new Error(`Invalid search field identifier: ${col}`);
              }
              return col;
            });
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

          const rows = await db.execute<Record<string, unknown>>(
            `SELECT * FROM flowpanel_pipeline_run
           ${whereClause}
           ORDER BY id DESC
           LIMIT $${params.length + 1}`,
            [...params, input.limit + 1],
          );

          const hasNextPage = rows.length > input.limit;
          const data = hasNextPage ? rows.slice(0, input.limit) : rows;
          const nextCursor = hasNextPage ? String(data[data.length - 1]?.id) : null;

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
          ctx: FlowPanelContext & { session: any };
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
          ctx: FlowPanelContext & { session: any };
          input: z.infer<typeof retryInputSchema>;
        }) => {
          const { db, config, session } = ctx;

          if (!(config as any).pipeline.onRetry) {
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
            [run.stage, run.id],
          );

          await (config as any).pipeline.onRetry(
            {
              stage: run.stage as string,
              fields: run as any,
              errorClass: run.error_class as string | undefined,
              errorMessage: run.error_message as string | undefined,
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
          ctx: FlowPanelContext & { session: any };
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
          ctx: FlowPanelContext & { session: any };
          input: z.infer<typeof bulkRetryInputSchema>;
        }) => {
          const { db, config } = ctx;

          if (!(config as any).pipeline.onRetry) {
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
              await (config as any).pipeline.onRetry?.(
                { stage: run.stage as string, fields: run as any },
                { userId: ctx.session.userId, db },
              );
              results.push({ runId: String(run.id), success: true });
            } catch (err) {
              results.push({ runId: String(run.id), success: false, error: String(err) });
            }
          }

          return { total: runs.length, results };
        },
      ),

    chart: authedProcedure
      .input(chartInputSchema)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: any };
          input: z.infer<typeof chartInputSchema>;
        }) => {
          const { db } = ctx;
          const interval = getIntervalSql(input.timeRange);

          const bucketConfigs: Record<string, { count: number; stepMinutes: number }> = {
            "1h": { count: 12, stepMinutes: 5 },
            "6h": { count: 12, stepMinutes: 30 },
            "24h": { count: 24, stepMinutes: 60 },
            "7d": { count: 28, stepMinutes: 360 },
            "30d": { count: 30, stepMinutes: 1440 },
          };

          const { count: bucketCount, stepMinutes } = bucketConfigs[input.timeRange];

          const rows = await db.execute<{
            bucket: string;
            total: string;
            succeeded: string;
            failed: string;
          }>(
            `WITH buckets AS (
              SELECT generate_series(
                now() - interval '${interval}',
                now() - interval '${stepMinutes} minutes',
                interval '${stepMinutes} minutes'
              ) AS bucket_start
            )
            SELECT
              b.bucket_start AS bucket,
              COALESCE(COUNT(r.id), 0) AS total,
              COALESCE(COUNT(r.id) FILTER (WHERE r.status = 'succeeded'), 0) AS succeeded,
              COALESCE(COUNT(r.id) FILTER (WHERE r.status = 'failed'), 0) AS failed
            FROM buckets b
            LEFT JOIN flowpanel_pipeline_run r
              ON r.started_at >= b.bucket_start
              AND r.started_at < b.bucket_start + interval '${stepMinutes} minutes'
            GROUP BY b.bucket_start
            ORDER BY b.bucket_start`,
            [],
          );

          const buckets = rows.map((row) => ({
            label: String(row.bucket),
            total: Number(row.total),
            succeeded: Number(row.succeeded),
            failed: Number(row.failed),
          }));

          let peakBucket = 0;
          let peakTotal = 0;
          for (let i = 0; i < buckets.length; i++) {
            if (buckets[i].total > peakTotal) {
              peakTotal = buckets[i].total;
              peakBucket = i;
            }
          }

          return { buckets, peakBucket };
        },
      ),

    topErrors: authedProcedure
      .input(topErrorsInputSchema)
      .query(
        async ({
          ctx,
          input,
        }: {
          ctx: FlowPanelContext & { session: any };
          input: z.infer<typeof topErrorsInputSchema>;
        }) => {
          const { db } = ctx;
          const interval = getIntervalSql(input.timeRange);
          const limit = input.limit ?? 10;

          const rows = await db.execute<{ error_class: string; count: string }>(
            `SELECT error_class, COUNT(*) AS count
            FROM flowpanel_pipeline_run
            WHERE error_class IS NOT NULL
              AND started_at >= now() - interval '${interval}'
            GROUP BY error_class
            ORDER BY count DESC
            LIMIT $1`,
            [limit],
          );

          return rows.map((row) => ({
            errorClass: row.error_class,
            count: Number(row.count),
          }));
        },
      ),
  });
}
