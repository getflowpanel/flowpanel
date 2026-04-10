import { z } from "zod";
import type { FlowPanelContext } from "../context.js";

export function createStagesProcedures(
	// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
	t: { procedure: any; router: (routes: any) => any },
	// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
	authedProcedure: any,
) {
	return t.router({
		summary: authedProcedure
			.input(
				z.object({
					timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
				}),
			)
			// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
			.query(async ({ ctx, input }: { ctx: FlowPanelContext & { session: any }; input: any }) => {
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
				return stages.map((stage) => {
					const row = byStage.get(stage);
					return {
						stage,
						// biome-ignore lint/suspicious/noExplicitAny: tRPC internal and config extension types
						color: (config.pipeline as any).stageColors?.[stage] ?? null,
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
