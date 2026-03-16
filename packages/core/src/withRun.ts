import { AsyncLocalStorage } from "node:async_hooks";
import type { SqlExecutor } from "./types/db.js";
import { fieldNameToColumn } from "./schemaGenerator.js";
import { redactObject } from "./redaction.js";
import { sanitizeError } from "./errorSanitizer.js";

export interface RunHandle {
  id: bigint;
  set(fields: Record<string, unknown>): void;
  heartbeat(): Promise<void>;
}

interface WithRunOptions {
  db: SqlExecutor;
  stageFields: Record<string, Record<string, unknown>>;
  stages: readonly string[];
  cwd: string;
  redactionKeys: string[];
}

// Track active run per async context for nested detection
const activeRunStorage = new AsyncLocalStorage<{ runId: bigint; stage: string }>();

export function createWithRun(opts: WithRunOptions) {
  const { db, stageFields, cwd, redactionKeys } = opts;

  return async function withRun<T>(
    stage: string,
    callback: (run: RunHandle) => Promise<T>
  ): Promise<T> {
    // Detect nested withRun
    const parentCtx = activeRunStorage.getStore();
    if (parentCtx) {
      console.warn(
        `[flowpanel] nested withRun detected. ` +
        `Parent: run_${parentCtx.runId} (${parentCtx.stage}), ` +
        `Child: new run (${stage}). ` +
        `Consider: is this intentional sub-stage tracking?`
      );
    }

    // INSERT running row
    const rows = await db.execute<{ id: bigint }>(
      `INSERT INTO flowpanel_pipeline_run (stage, status, started_at)
       VALUES ($1, $2, now())
       RETURNING id`,
      [stage, "running"]
    );

    const runId = rows[0]?.id;
    if (runId == null) throw new Error("[flowpanel] Failed to create run row");

    const debug = process.env.NODE_ENV === "development" || process.env.FLOWPANEL_DEBUG === "1";
    if (debug) console.debug(`[flowpanel] withRun("${stage}")  started    runId=${runId}`);

    const accumulatedFields: Record<string, unknown> = {};

    const run: RunHandle = {
      id: runId,
      set(fields) {
        const stageSchema = stageFields[stage] ?? {};
        const redacted = redactObject(fields, redactionKeys);
        for (const [key, value] of Object.entries(redacted)) {
          if (key in stageSchema) {
            const col = `${stage}_${fieldNameToColumn(key)}`;
            accumulatedFields[col] = value;
          } else {
            // flat/reserved field
            accumulatedFields[fieldNameToColumn(key)] = value;
          }
        }
        if (debug) console.debug(`[flowpanel] withRun("${stage}")  run.set()`, redacted);
      },
      async heartbeat() {
        await db.execute(
          `UPDATE flowpanel_pipeline_run SET heartbeat_at = now() WHERE id = $1`,
          [String(runId)]
        );
      },
    };

    return await activeRunStorage.run({ runId, stage }, async () => {
      try {
        const result = await callback(run);

        // Build SET clause for accumulated fields
        const fieldEntries = Object.entries(accumulatedFields);
        const fieldSetClause = fieldEntries
          .map(([col], i) => `${col} = $${i + 4}`)
          .join(", ");
        const fieldValues = fieldEntries.map(([, v]) => v);

        // Build SET clause: embed 'succeeded' literal so tests can match on sql text
        const succeedSetClause = [
          "status = 'succeeded'",
          "finished_at = $2",
          fieldSetClause,
        ]
          .filter(Boolean)
          .join(", ");

        // Idempotent: if already finalized, RETURNING returns 0 rows → skip
        const updated = await db.execute<{ id: bigint }>(
          `UPDATE flowpanel_pipeline_run
           SET ${succeedSetClause}
           WHERE id = $1 AND status = 'running'
           RETURNING id`,
          [String(runId), new Date(), ...fieldValues]
        );

        if (updated.length > 0) {
          // Emit pg_notify for SSE delivery
          await db.execute(
            `SELECT pg_notify('flowpanel_events', $1)`,
            [JSON.stringify({ event: "run.finished", id: String(runId), stage, status: "succeeded" })]
          );
        }

        if (debug) console.debug(`[flowpanel] withRun("${stage}")  succeeded  runId=${runId}`);
        return result;
      } catch (err) {
        const { errorClass, errorMessage, errorStack } = sanitizeError(err, cwd);

        await db.execute(
          `UPDATE flowpanel_pipeline_run
           SET status = 'failed', finished_at = $2, error_class = $3, error_message = $4, error_stack = $5
           WHERE id = $1 AND status = 'running'`,
          [String(runId), new Date(), errorClass, errorMessage, errorStack]
        );

        await db.execute(
          `SELECT pg_notify('flowpanel_events', $1)`,
          [JSON.stringify({ event: "run.failed", id: String(runId), stage, status: "failed", errorClass })]
        );

        if (debug) console.debug(`[flowpanel] withRun("${stage}")  failed     runId=${runId}  errorClass=${errorClass}`);
        throw err; // re-throw original
      }
    });
  };
}
