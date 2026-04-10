import { z } from "zod";
import type { FlowPanelContext } from "../context.js";

export function createDrawersProcedures(
	t: { procedure: any; router: (routes: any) => any },
	authedProcedure: any,
) {
	return t.router({
		render: authedProcedure
			.input(
				z.object({
					drawerId: z.string(),
					runId: z.string().optional(),
					timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
				}),
			)
			.query(async ({ ctx, input }: { ctx: FlowPanelContext & { session: any }; input: any }) => {
				const { db, config } = ctx;
				const drawerConfig = (config as any).drawers?.[input.drawerId];
				if (!drawerConfig) throw new Error(`Drawer "${input.drawerId}" not found in config`);

				const sections: Record<string, unknown>[] = [];

				for (const section of drawerConfig.sections) {
					try {
						const data = await renderSection(db, config, section, input);
						sections.push({ type: section.type, data });
					} catch (err) {
						sections.push({ type: section.type, error: String(err) });
					}
				}

				let run: Record<string, unknown> | null = null;
				if (input.runId) {
					const rows = await db.execute<Record<string, unknown>>(
						`SELECT * FROM flowpanel_pipeline_run WHERE id = $1 LIMIT 1`,
						[BigInt(input.runId)],
					);
					run = rows[0] ?? null;
				}

				return { sections, run };
			}),
	});
}

async function renderSection(db: any, config: any, section: any, input: any): Promise<unknown> {
	const timeWhere = input.timeRange ? `WHERE started_at >= $1 AND started_at < $2` : "";
	const timeParams = input.timeRange ? [input.timeRange.start, input.timeRange.end] : [];

	switch (section.type) {
		case "stat-grid": {
			const rows = await db.execute(
				`SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) AS succeeded,
           SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
           SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
           AVG(duration_ms) AS avg_duration,
           percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_duration
         FROM flowpanel_pipeline_run ${timeWhere}`,
				timeParams,
			);
			return rows[0];
		}
		case "breakdown": {
			const groupBy = section.groupBy ?? "stage";
			const rows = await db.execute(
				`SELECT ${groupBy}, COUNT(*) AS count
         FROM flowpanel_pipeline_run ${timeWhere}
         GROUP BY ${groupBy}
         ORDER BY count DESC`,
				timeParams,
			);
			return rows;
		}
		case "error-list": {
			const limit = section.limit ?? 5;
			const rows = await db.execute(
				`SELECT error_class, COUNT(*) AS count
         FROM flowpanel_pipeline_run
         ${timeWhere ? timeWhere + " AND" : "WHERE"} error_class IS NOT NULL
         GROUP BY error_class
         ORDER BY count DESC
         LIMIT ${limit}`,
				timeParams,
			);
			return rows;
		}
		case "trend-chart": {
			const rows = await db.execute(
				`SELECT date_trunc('hour', started_at) AS bucket, COUNT(*) AS value
         FROM flowpanel_pipeline_run ${timeWhere}
         GROUP BY bucket ORDER BY bucket`,
				timeParams,
			);
			return rows;
		}
		case "kv-grid": {
			if (!input.runId) return {};
			const rows = await db.execute<Record<string, unknown>>(
				`SELECT * FROM flowpanel_pipeline_run WHERE id = $1 LIMIT 1`,
				[BigInt(input.runId)],
			);
			const run = rows[0];
			if (!run) return {};
			const fields: Record<string, unknown> = {};
			const keys = section.fields as string[] | undefined;
			if (keys && keys.length > 0) {
				for (const k of keys) {
					fields[k] = run[k] ?? null;
				}
			} else {
				// return all non-null scalar fields
				for (const [k, v] of Object.entries(run)) {
					if (v !== null && v !== undefined) fields[k] = v;
				}
			}
			return fields;
		}
		case "error-block": {
			if (!input.runId) return null;
			const rows = await db.execute<Record<string, unknown>>(
				`SELECT error_class, error_message, stack_trace FROM flowpanel_pipeline_run WHERE id = $1 LIMIT 1`,
				[BigInt(input.runId)],
			);
			const run = rows[0];
			if (!run) return null;
			return {
				errorClass: run["error_class"] ?? "UnknownError",
				errorMessage: run["error_message"] ?? "",
				stackTrace: run["stack_trace"] ?? undefined,
			};
		}
		case "timeline": {
			if (!input.runId) return [];
			// Try to get stage-level rows first (if a stage_runs table exists)
			try {
				const stageRows = await db.execute<Record<string, unknown>>(
					`SELECT stage AS step, duration_ms, status
           FROM flowpanel_pipeline_stage_run
           WHERE run_id = $1
           ORDER BY started_at ASC`,
					[BigInt(input.runId)],
				);
				if (stageRows.length > 0) {
					return stageRows.map((r) => ({
						step: String(r["step"] ?? ""),
						durationMs: Number(r["duration_ms"] ?? 0),
						status: String(r["status"] ?? "succeeded") as "succeeded" | "failed" | "running",
					}));
				}
			} catch {
				// fall through to single-run fallback
			}
			// Fallback: single row representing the whole run
			const rows = await db.execute<Record<string, unknown>>(
				`SELECT stage, duration_ms, status FROM flowpanel_pipeline_run WHERE id = $1 LIMIT 1`,
				[BigInt(input.runId)],
			);
			const run = rows[0];
			if (!run) return [];
			return [
				{
					step: String(run["stage"] ?? "run"),
					durationMs: Number(run["duration_ms"] ?? 0),
					status: String(run["status"] ?? "succeeded") as "succeeded" | "failed" | "running",
				},
			];
		}
		default:
			return null;
	}
}
