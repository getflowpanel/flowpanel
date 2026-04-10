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

const ALLOWED_GROUP_COLUMNS = new Set(["stage", "status", "partition_key", "error_class"]);

async function renderSection(db: any, _config: any, section: any, input: any): Promise<unknown> {
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
      if (!ALLOWED_GROUP_COLUMNS.has(groupBy)) {
        throw new Error(`Invalid groupBy column: ${groupBy}`);
      }
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
      const params = [...timeParams, limit];
      const limitIdx = params.length;
      const rows = await db.execute(
        `SELECT error_class, COUNT(*) AS count
         FROM flowpanel_pipeline_run
         ${timeWhere ? `${timeWhere} AND` : "WHERE"} error_class IS NOT NULL
         GROUP BY error_class
         ORDER BY count DESC
         LIMIT $${limitIdx}`,
        params,
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
      if (!input.runId) return null;
      const rows = await db.execute<Record<string, unknown>>(
        `SELECT * FROM flowpanel_pipeline_run WHERE id = $1 LIMIT 1`,
        [BigInt(input.runId)],
      );
      if (!rows[0]) return null;
      const run = rows[0];
      // Return configured fields or all fields
      const fields = section.fields as string[] | undefined;
      if (fields) {
        const result: Record<string, unknown> = {};
        for (const f of fields) {
          result[f] = run[f] ?? null;
        }
        return result;
      }
      // Default useful fields
      const { id, stage, status, partition_key, started_at, finished_at, duration_ms, ...rest } =
        run;
      return {
        id: String(id),
        stage,
        status,
        partition_key,
        started_at,
        finished_at,
        duration_ms,
        ...rest,
      };
    }
    case "error-block": {
      if (!input.runId) return null;
      const rows = await db.execute<Record<string, unknown>>(
        `SELECT error_class, error_message, error_stack FROM flowpanel_pipeline_run WHERE id = $1 LIMIT 1`,
        [BigInt(input.runId)],
      );
      const run = rows[0];
      if (!run || !run.error_class) return null;
      return {
        errorClass: run.error_class as string,
        message: (run.error_message as string) ?? "",
        stack: (run.error_stack as string) ?? undefined,
      };
    }
    case "timeline": {
      if (!input.runId) return null;
      // Try step data first, fall back to single-step from run
      const rows = await db.execute<Record<string, unknown>>(
        `SELECT * FROM flowpanel_pipeline_run WHERE id = $1 LIMIT 1`,
        [BigInt(input.runId)],
      );
      const run = rows[0];
      if (!run) return null;
      return [
        {
          step: run.stage as string,
          durationMs: (run.duration_ms as number) ?? 0,
          status: run.status as string,
        },
      ];
    }
    default:
      return null;
  }
}
