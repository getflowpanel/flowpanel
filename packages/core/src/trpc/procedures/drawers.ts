import { z } from "zod";
import type { FlowPanelContext } from "../context.js";

export function createDrawersProcedures(
  t: { procedure: any; router: (routes: any) => any },
  authedProcedure: any
) {
  return t.router({
    render: authedProcedure
      .input(z.object({
        drawerId: z.string(),
        runId: z.string().optional(),
        timeRange: z.object({ start: z.date(), end: z.date() }).optional(),
      }))
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
            [BigInt(input.runId)]
          );
          run = rows[0] ?? null;
        }

        return { sections, run };
      }),
  });
}

async function renderSection(
  db: any,
  config: any,
  section: any,
  input: any
): Promise<unknown> {
  const timeWhere = input.timeRange
    ? `WHERE started_at >= $1 AND started_at < $2`
    : "";
  const timeParams = input.timeRange
    ? [input.timeRange.start, input.timeRange.end]
    : [];

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
        timeParams
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
        timeParams
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
        timeParams
      );
      return rows;
    }
    case "trend-chart": {
      const rows = await db.execute(
        `SELECT date_trunc('hour', started_at) AS bucket, COUNT(*) AS value
         FROM flowpanel_pipeline_run ${timeWhere}
         GROUP BY bucket ORDER BY bucket`,
        timeParams
      );
      return rows;
    }
    case "kv-grid":
      return null;
    case "error-block":
      return null;
    default:
      return null;
  }
}
