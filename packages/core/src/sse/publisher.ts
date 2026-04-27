/**
 * Realtime publisher — writes a row to `flowpanel_events`, which the SSE
 * broker picks up via LISTEN (PostgreSQL) or polling (fallback) and fans
 * out to connected clients.
 *
 * Event naming convention:
 *   - `resource.<key>` — a row was created/updated/deleted on resource <key>.
 *   - data: `{ op: "create" | "update" | "delete" | "action"; id?: string | number; actionId?: string }`
 *
 * Writes are fire-and-forget: failures are logged and swallowed so a broken
 * broker can never fail the underlying mutation. Only called when the
 * resource opts in with `realtime: true`.
 */

import type { SqlExecutor } from "../types/db";

export interface ResourceEventPayload {
  op: "create" | "update" | "delete" | "action";
  id?: string | number;
  actionId?: string;
}

export async function publishResourceEvent(
  db: SqlExecutor,
  resourceKey: string,
  payload: ResourceEventPayload,
): Promise<void> {
  try {
    await db.execute(`INSERT INTO flowpanel_events (event, data) VALUES ($1, $2)`, [
      `resource.${resourceKey}`,
      JSON.stringify(payload),
    ]);
  } catch (err) {
    console.warn(
      `[flowpanel] realtime publish for resource "${resourceKey}" failed — continuing: ${String(err)}`,
    );
  }
}
