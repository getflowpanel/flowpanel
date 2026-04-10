import * as crypto from "node:crypto";
import type { SqlExecutor } from "./types/db.js";

const REAPER_LOCK_KEY = BigInt(
  `0x${crypto.createHash("md5").update("flowpanel:reaper").digest("hex").slice(0, 16)}`,
);

const DEFAULT_THRESHOLD = "10m";

function intervalToMinutes(interval: string): number {
  const match = interval.match(/^(\d+)([smh])$/);
  if (!match) return 10;
  const [, num, unit] = match;
  switch (unit) {
    case "s":
      return parseInt(num!, 10) / 60;
    case "m":
      return parseInt(num!, 10);
    case "h":
      return parseInt(num!, 10) * 60;
    default:
      return 10;
  }
}

export interface ReaperOptions {
  db: SqlExecutor;
  stages: readonly string[];
  reaperThresholds: Partial<Record<string, string>>;
}

export interface Reaper {
  sweep(): Promise<{ recovered: bigint[] }>;
  start(intervalMs: number): () => void;
}

export function createReaper(opts: ReaperOptions): Reaper {
  const { db, stages, reaperThresholds } = opts;

  async function sweep(): Promise<{ recovered: bigint[] }> {
    // Non-blocking: if lock unavailable, skip this tick
    const locked = await db.advisoryTryLock(REAPER_LOCK_KEY);
    if (!locked) return { recovered: [] };

    const recovered: bigint[] = [];

    try {
      for (const stage of stages) {
        const threshold = reaperThresholds[stage] ?? DEFAULT_THRESHOLD;
        const thresholdMinutes = intervalToMinutes(threshold);
        // Heartbeat staleness: 3 minutes (fixed)
        const rows = await db.execute<{ id: bigint }>(
          `UPDATE flowpanel_pipeline_run
           SET
             status        = 'failed',
             finished_at   = now(),
             error_class   = 'OrphanedRun',
             error_message = 'Run exceeded timeout without heartbeat — recovered by reaper'
           WHERE status = 'running'
             AND stage = $1
             AND started_at < now() - make_interval(mins => $2)
             AND (heartbeat_at IS NULL OR heartbeat_at < now() - INTERVAL '3 minutes')
           RETURNING id`,
          [stage, thresholdMinutes],
        );

        for (const row of rows) {
          recovered.push(row.id);
          // Emit pg_notify for SSE
          await db.execute(`SELECT pg_notify('flowpanel_events', $1)`, [
            JSON.stringify({
              event: "run.failed",
              id: String(row.id),
              stage,
              errorClass: "OrphanedRun",
            }),
          ]);
        }
      }

      if (
        recovered.length > 0 &&
        (process.env.FLOWPANEL_DEBUG === "1" || process.env.NODE_ENV === "development")
      ) {
        console.debug(`[flowpanel] reaper  recovered  runIds=[${recovered.join(", ")}]`);
      }
    } finally {
      await db.advisoryUnlock(REAPER_LOCK_KEY);
    }

    return { recovered };
  }

  function start(intervalMs: number): () => void {
    const timer = setInterval(() => {
      sweep().catch((err) => console.error("[flowpanel] reaper error:", err));
    }, intervalMs);
    // Don't block process exit
    if (timer.unref) timer.unref();
    return () => clearInterval(timer);
  }

  return { sweep, start };
}
