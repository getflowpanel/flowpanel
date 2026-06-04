import type { AuditConfig, AuditEvent } from "../types/config.js";

/**
 * Forward an audit event to the configured `AuditConfig.sink`, swallowing
 * sink errors so audit failure never breaks the underlying user action.
 * `@flowpanel/kit/next` auto-emits on CRUD mutations, row actions, bulk actions,
 * inline edits, and drawer actions; call this directly from custom server
 * code that should also be auditable.
 *
 * No-ops when:
 *
 * - `cfg` is undefined (no `defineAdmin({ audit })` configured).
 * - `cfg.enabled === false` (audit globally disabled).
 * - `cfg.sink` is missing (nothing to forward to).
 *
 * Sink errors are logged in dev (via `console.error`) and silently dropped
 * in production — the user's mutation already succeeded and we don't want
 * a flaky logging backend to surface as a 500.
 *
 * @example Persist to a Drizzle table
 * ```ts
 * import { db } from "@/server/db";
 * import { auditLog } from "@/server/db/schema";
 *
 * defineAdmin({
 *   audit: {
 *     enabled: true,
 *     sink: async (event) => {
 *       await db.insert(auditLog).values({
 *         actorId: event.actorId,
 *         action: event.action,
 *         resource: event.resource ?? null,
 *         targetId: event.targetId ?? null,
 *         diff: event.diff ?? null,
 *         at: event.at,
 *         ip: event.ip ?? null,
 *         userAgent: event.userAgent ?? null,
 *       });
 *     },
 *   },
 * });
 * ```
 */
export async function emitAudit(cfg: AuditConfig | undefined, event: AuditEvent): Promise<void> {
  if (!cfg) return;
  if (cfg.enabled === false) return;
  if (!cfg.sink) return;
  try {
    await cfg.sink(event);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[flowpanel] audit sink error:", err);
    }
  }
}
