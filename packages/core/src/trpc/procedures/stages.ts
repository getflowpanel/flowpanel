import { z } from "zod";
import type { AuthedContext, FlowPanelTRPC } from "../types";

const stagesInputSchema = z.object({
  timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
});
type StagesInput = z.infer<typeof stagesInputSchema>;

export function createStagesProcedures(t: FlowPanelTRPC, authedProcedure: unknown) {
  // biome-ignore lint/suspicious/noExplicitAny: tRPC procedure builder
  const p = authedProcedure as any;
  return t.router({
    summary: p
      .input(stagesInputSchema)
      .query(async ({ ctx, input }: { ctx: AuthedContext; input: StagesInput }) => {
        const { db, config } = ctx;
        const stages = config.pipeline.stages;
        const params: unknown[] = [];
        let whereClause = "";

        if (input.timeRange) {
          whereClause = `WHERE started_at >= $1 AND started_at < $2`;
          params.push(input.timeRange.start, input.timeRange.end);
        }

        const rows = await db.execute<{
          stage: string;
          total: bigint;
          succeeded: bigint;
          failed: bigint;
          running: bigint;
          avg_duration_ms: number | null;
        }>(
          `SELECT
             stage,
             COUNT(*) AS total,
             SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
             SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
             SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
             AVG(duration_ms) AS avg_duration_ms
           FROM flowpanel_pipeline_run
           ${whereClause}
           GROUP BY stage`,
          params,
        );

        const byStage = new Map(rows.map((r) => [r.stage, r]));
        const stageColors = (config.pipeline as { stageColors?: Record<string, string> })
          .stageColors;
        return stages.map((stage) => {
          const row = byStage.get(stage);
          return {
            stage,
            color: stageColors?.[stage] ?? null,
            total: Number(row?.total ?? 0),
            succeeded: Number(row?.succeeded ?? 0),
            failed: Number(row?.failed ?? 0),
            running: Number(row?.running ?? 0),
            avgDurationMs: row?.avg_duration_ms ?? null,
          };
        });
      }),
  });
}
