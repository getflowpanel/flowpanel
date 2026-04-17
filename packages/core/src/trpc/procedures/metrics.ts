import { z } from "zod";
import { createQueryBuilder } from "../../queryBuilder";
import type { FlowPanelContext } from "../context";

export function createMetricsProcedures(
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal builder type
  t: { procedure: any; router: (routes: any) => any },
  // biome-ignore lint/suspicious/noExplicitAny: tRPC internal procedure type
  authedProcedure: any,
) {
  return t.router({
    getAll: authedProcedure
      .input(
        z.object({
          timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
        }),
      )
      // biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
      .query(async ({ ctx, input }: { ctx: FlowPanelContext & { session: any }; input: any }) => {
        const { db, config } = ctx;
        const metrics = config.metrics ?? {};
        const results: Record<string, unknown> = {};

        for (const [name, metricConfig] of Object.entries(metrics)) {
          try {
            if ("custom" in metricConfig.query) {
              results[name] = await metricConfig.query.custom(db, {
                range: input.timeRange ?? defaultRange(),
              });
            } else {
              const qb = createQueryBuilder({
                stages: config.pipeline.stages,
                stageFields: config.pipeline.stageFields,
                fields: config.pipeline.fields,
              });
              const queryDef = metricConfig.query(qb);
              const rows = await db.execute<{ value: unknown }>(queryDef.sql, queryDef.params);
              results[name] = { value: rows[0]?.value ?? null };
            }
          } catch (err) {
            results[name] = { error: String(err) };
          }
        }

        return results;
      }),

    get: authedProcedure
      .input(
        z.object({
          name: z.string(),
          timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
        }),
      )
      // biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
      .query(async ({ ctx, input }: { ctx: FlowPanelContext & { session: any }; input: any }) => {
        const { db, config } = ctx;
        const metricConfig = config.metrics?.[input.name];
        if (!metricConfig) throw new Error(`Metric "${input.name}" not found`);

        if ("custom" in metricConfig.query) {
          return metricConfig.query.custom(db, { range: input.timeRange ?? defaultRange() });
        }

        const qb = createQueryBuilder({
          stages: config.pipeline.stages,
          stageFields: config.pipeline.stageFields,
          fields: config.pipeline.fields,
        });
        const queryDef = metricConfig.query(qb);
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
