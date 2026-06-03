import { FlowpanelAccessError } from "../types/error.js";
import type { Session } from "../types/session.js";

export type RequireRole = string | string[] | ((s: Session | null) => boolean) | undefined;

/**
 * Throws `FlowpanelAccessError` if the caller's `role` (or `session`) doesn't
 * match the `required` policy. Used by:
 *
 * - The page-level wrapper before rendering any resource / dashboard
 *   (driven by `resource.options.requireRole`).
 * - Per-action gates: `RowAction.requireRole`, `BulkAction.requireRole`,
 *   `DrawerAction.requireRole`.
 * - Custom server code that wants the same shape.
 *
 * @example Single role
 * ```ts
 * checkRequireRole("admin", session?.role ?? "guest", session);
 * ```
 *
 * @example Multiple roles
 * ```ts
 * checkRequireRole(["admin", "editor"], session?.role ?? "guest", session);
 * ```
 *
 * @example Custom predicate
 * ```ts
 * checkRequireRole((s) => s?.org === "acme", role, session);
 * ```
 *
 * `required === undefined` is treated as "no policy" and always passes —
 * mirrors the option being absent.
 */
export function checkRequireRole(
  required: RequireRole,
  role: string,
  session: Session | null,
): void {
  if (required === undefined) return;
  if (typeof required === "function") {
    if (!required(session)) throw new FlowpanelAccessError();
    return;
  }
  const allowed = Array.isArray(required) ? required : [required];
  if (!allowed.includes(role)) throw new FlowpanelAccessError();
}
