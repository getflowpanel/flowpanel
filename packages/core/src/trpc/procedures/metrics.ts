import { z } from "zod";
import { createQueryBuilder } from "../../queryBuilder.js";
import type { FlowPanelContext } from "../context.js";

export function createMetricsProcedures(
  t: { procedure: any; router: (routes: any) => any },
  authedProcedure: any,
) {
  return t.router({
    getAll: authedProcedure
      .input(
        z.object({
          timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
        }),
      )
      .query(async ({ ctx, input }: { ctx: FlowPanelContext & { session: any }; input: any }) => {
        const { db, config } = ctx;
        const metrics = (config as any).metrics ?? {};
        const results: Record<string, unknown> = {};

        for (const [name, metricConfig] of Object.entries(metrics)) {
          try {
            const mc = metricConfig as any;
            if ("custom" in mc.query) {
              results[name] = await mc.query.custom(db, {
                range: input.timeRange ?? defaultRange(),
              });
            } else {
              const qb = createQueryBuilder({
                stages: config.pipeline.stages,
                stageFields: (config.pipeline as any).stageFields ?? {},
                fields: (config.pipeline as any).fields ?? {},
              });
              const queryDef = mc.query(qb);
              const rows = await db.execute(queryDef.sql, queryDef.params ?? []);
              results[name] = { value: (rows[0] as any)?.value ?? null };
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
      .query(async ({ ctx, input }: { ctx: FlowPanelContext & { session: any }; input: any }) => {
        const { db, config } = ctx;
        const metricConfig = (config as any).metrics?.[input.name];
        if (!metricConfig) throw new Error(`Metric "${input.name}" not found`);

        if ("custom" in metricConfig.query) {
          return metricConfig.query.custom(db, { range: input.timeRange ?? defaultRange() });
        }

        const qb = createQueryBuilder({
          stages: config.pipeline.stages,
          stageFields: (config.pipeline as any).stageFields ?? {},
          fields: (config.pipeline as any).fields ?? {},
        });
        const queryDef = metricConfig.query(qb);
        const rows = await db.execute(queryDef.sql, queryDef.params ?? []);
        return { value: (rows[0] as any)?.value ?? null };
      }),
  });
}

function defaultRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return { start, end };
}
