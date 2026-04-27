import { z } from "zod";
import { createQueryBuilder, type QueryBuilder } from "../../queryBuilder";
import type { SqlExecutor } from "../../types/db";
import type { AuthedContext, FlowPanelTRPC } from "../types";

// `metrics[*].query` is validated by Zod as `Record<string, unknown>` because
// its exact shape depends on how a consumer wires up the query builder. At
// runtime we know it's either a qb → { sql, params } function or an object
// with `custom(db, opts)`. Narrow here to keep the caller code readable.
type CustomMetricQuery = {
  custom: (db: SqlExecutor, opts: { range: { start: Date; end: Date } }) => Promise<unknown>;
};
type BuilderMetricQuery = (qb: QueryBuilder) => { sql: string; params: unknown[] };
type MetricQuery = CustomMetricQuery | BuilderMetricQuery;

function isCustom(q: MetricQuery): q is CustomMetricQuery {
  return typeof q === "object" && q !== null && "custom" in q;
}

const getAllInputSchema = z.object({
  timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
});
type GetAllInput = z.infer<typeof getAllInputSchema>;

const getInputSchema = z.object({
  name: z.string(),
  timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
});
type GetInput = z.infer<typeof getInputSchema>;

export function createMetricsProcedures(t: FlowPanelTRPC, authedProcedure: unknown) {
  // biome-ignore lint/suspicious/noExplicitAny: tRPC procedure builder
  const p = authedProcedure as any;
  return t.router({
    getAll: p
      .input(getAllInputSchema)
      .query(async ({ ctx, input }: { ctx: AuthedContext; input: GetAllInput }) => {
        const { db, config } = ctx;
        const metrics = config.metrics ?? {};
        const results: Record<string, unknown> = {};

        for (const [name, metricConfig] of Object.entries(metrics)) {
          const query = metricConfig.query as unknown as MetricQuery;
          try {
            if (isCustom(query)) {
              results[name] = await query.custom(db, {
                range: input.timeRange ?? defaultRange(),
              });
            } else {
              const qb = createQueryBuilder({
                stages: config.pipeline.stages,
                stageFields: config.pipeline.stageFields,
                fields: config.pipeline.fields,
              });
              const queryDef = query(qb);
              const rows = await db.execute<{ value: unknown }>(queryDef.sql, queryDef.params);
              results[name] = { value: rows[0]?.value ?? null };
            }
          } catch (err) {
            results[name] = { error: String(err) };
          }
        }

        return results;
      }),

    get: p
      .input(getInputSchema)
      .query(async ({ ctx, input }: { ctx: AuthedContext; input: GetInput }) => {
        const { db, config } = ctx;
        const metricConfig = config.metrics?.[input.name];
        if (!metricConfig) throw new Error(`Metric "${input.name}" not found`);
        const query = metricConfig.query as unknown as MetricQuery;

        if (isCustom(query)) {
          return query.custom(db, { range: input.timeRange ?? defaultRange() });
        }

        const qb = createQueryBuilder({
          stages: config.pipeline.stages,
          stageFields: config.pipeline.stageFields,
          fields: config.pipeline.fields,
        });
        const queryDef = query(qb);
        const rows = await db.execute<{ value: unknown }>(queryDef.sql, queryDef.params);
        return { value: rows[0]?.value ?? null };
      }),
  });
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}
