import type {
  ActionResult,
  AuditConfig,
  AuditEvent,
  FieldDef,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { checkRequireRole, emitAudit } from "@flowpanel/core";
import type { z } from "zod";
import { requireAuthorized } from "./require-authorized.js";

/**
 * Pull the actor id out of a session blob in the value-safe way every action
 * handler needs. Returns `null` for missing / anonymous / non-string ids so
 * audit rows always carry a usable column (or null).
 *
 * The session shape is `Record<string, unknown>` by design (so consumers can
 * augment with their own user fields). This helper safely narrows to
 * `session.user.id` if both layers exist and the leaf is a string.
 */
export function actorIdFromSession(session: RequestContext["session"]): string | null {
  if (!session || typeof session !== "object") return null;
  const user = (session as { user?: unknown }).user;
  if (user && typeof user === "object" && "id" in user) {
    const id = (user as { id?: unknown }).id;
    // String-coerce so numeric IDs (e.g. serial PKs in the with-clerk
    // example) survive the audit row instead of dropping to null. UUIDs
    // pass through unchanged.
    return id === undefined || id === null ? null : String(id);
  }
  return null;
}

/**
 * Resource-scoped role + scope guard, mirroring what every per-resource
 * action handler (row / bulk / inline / drawer) runs at the top. Returns a
 * 403 `Response` to short-circuit; returns `null` on success so the caller
 * keeps going.
 *
 * Centralizing this saves ~10 LOC per handler and ensures the error shape
 * stays consistent — a hand-crafted POST against any action gets the same
 * `{ ok: false, error: "<message>" }` JSON.
 */
export function guardResourceAccess(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
): Response | null {
  try {
    requireAuthorized(config, resource, reqCtx);
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "forbidden";
    return Response.json({ ok: false, error: msg }, { status: 403 });
  }
}

/**
 * Per-action `requireRole` guard. Resource-level access has already passed
 * by the time this is called (see `guardResourceAccess`); this checks the
 * narrower per-action policy.
 *
 * Returns a 403 `Response` to short-circuit; returns `null` on success or
 * when `requiredRole` is `undefined` (no per-action policy).
 */
export function guardActionRole(
  requiredRole: string | string[] | undefined,
  reqCtx: RequestContext,
): Response | null {
  if (requiredRole === undefined) return null;
  try {
    checkRequireRole(requiredRole, reqCtx.role, reqCtx.session);
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "forbidden";
    return Response.json({ ok: false, error: msg }, { status: 403 });
  }
}

/**
 * Build the standard `AuditEvent` shape every action handler emits. The
 * `at` timestamp, `ip`, and `userAgent` fields are propagated from
 * `reqCtx` so every audit row carries them when present.
 *
 * `targetId` is the row id for per-row actions, a joined-id string for
 * bulk, the resource name for inline-edit, or the dashboard path for
 * dashboard actions.
 */
export function buildAuditEvent(
  reqCtx: RequestContext,
  base: { action: string; resource?: string; targetId?: string; diff?: AuditEvent["diff"] },
): AuditEvent {
  return {
    actorId: actorIdFromSession(reqCtx.session),
    action: base.action,
    at: new Date(),
    ...(base.resource !== undefined ? { resource: base.resource } : {}),
    ...(base.targetId !== undefined ? { targetId: base.targetId } : {}),
    ...(base.diff !== undefined ? { diff: base.diff } : {}),
    ...(reqCtx.ip ? { ip: reqCtx.ip } : {}),
    ...(reqCtx.userAgent ? { userAgent: reqCtx.userAgent } : {}),
  };
}

/**
 * Wrap an action handler's success branch with the audit emit.
 *
 * `resourceAudit === false` disables auditing for that resource (per the
 * `ResourceOptions.audit` opt-out); a missing `auditConfig` (no
 * `defineAdmin({ audit })`) is also a no-op. Otherwise the event is
 * forwarded to the configured sink.
 *
 * Mirrors what `emitAudit` does directly, but encapsulates the
 * resource-scoped opt-out check so callers stay DRY.
 */
export async function maybeEmitAudit(
  result: ActionResult,
  auditConfig: AuditConfig | undefined,
  resourceAudit: boolean | undefined,
  event: AuditEvent,
): Promise<void> {
  if (!result.ok) return;
  if (resourceAudit === false) return;
  await emitAudit(auditConfig, event);
}

/**
 * Whether auditing will actually fire for a given resource — used to skip
 * the extra "after" row fetch (see `computeShallowDiff`) when no sink is
 * configured or the resource opted out. Keeps the hot path free of an
 * audit-only query when nobody is listening.
 */
export function isAuditActive(
  auditConfig: AuditConfig | undefined,
  resourceAudit: boolean | undefined,
): boolean {
  if (resourceAudit === false) return false;
  return Boolean(auditConfig?.sink);
}

/**
 * Shallow before/after diff for an auto-audited mutation. Compares the row
 * snapshot taken before an action ran against the snapshot taken after,
 * keeping only the keys whose values changed (by `Object.is`).
 *
 * - both `null` → `undefined` (nothing to audit)
 * - `before === null` → treated as a create: `{ before: null, after }`
 * - `after === null` → treated as a delete: `{ before, after: null }`
 * - otherwise → `{ before: {…changed}, after: {…changed} }`, or `undefined`
 *   when no field changed (e.g. a side-effect-only action that didn't
 *   touch the row)
 *
 * Shallow by design: nested object/array fields are compared by reference,
 * so a deep mutation that keeps the same reference won't be detected. Audit
 * diffs are a human-readable trail, not a CDC log — shallow is the right
 * altitude and keeps the payload small.
 */
export function computeShallowDiff(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): AuditEvent["diff"] | undefined {
  if (before === null && after === null) return undefined;
  if (before === null) return { before: null, after };
  if (after === null) return { before, after: null };

  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (!Object.is(before[key], after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }
  if (Object.keys(changedAfter).length === 0) return undefined;
  return { before: changedBefore, after: changedAfter };
}

/**
 * Derive a client-safe error message from a thrown value. Raw `err.message`
 * can carry DB schema / column / row details, so action handlers must never
 * return it verbatim on a 500.
 *
 * Mirrors the `err.safeMessage ?? <fallback>` pattern in `resource-actions.ts`:
 * a `FlowpanelError` (or any error that opts in) exposes a curated
 * `safeMessage`; everything else collapses to a generic string.
 */
export function safeErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "safeMessage" in err) {
    const safe = (err as { safeMessage?: unknown }).safeMessage;
    if (typeof safe === "string" && safe) return safe;
  }
  return "internal error";
}

/**
 * A single field-level validation failure, shaped to match Zod's issue tuple
 * (`path` + `message`) so the client can map errors back to form inputs the
 * same way it does for the create / edit forms.
 */
export interface ActionInputIssue {
  path: (string | number)[];
  message: string;
}

/**
 * Validate a client-supplied action `input` against the action's declared
 * `form` (a `FieldDef[]`). Returns `null` when the input is valid (or there's
 * nothing to validate), or the list of issues when it isn't.
 *
 * Two checks per field, both defense-in-depth against a hand-crafted POST:
 *
 * 1. `required` — the value must be present (not `undefined` / `null` / `""`).
 * 2. `validate` when it's a Zod schema — `safeParse` the field value and
 *    surface the issues. Function-shaped `validate` is business logic the
 *    action itself owns; we don't run it here.
 *
 * A non-object `input` (with a non-empty form) is rejected outright since
 * field values can't be read from it.
 */
export function validateActionInput(
  form: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
): ActionInputIssue[] | null {
  if (!form || form.length === 0) return null;

  const values =
    input && typeof input === "object" ? (input as Record<string, unknown>) : undefined;
  if (values === undefined) {
    return [{ path: [], message: "input must be an object" }];
  }

  const issues: ActionInputIssue[] = [];
  for (const field of form) {
    const value = values[field.name];

    if (field.required && (value === undefined || value === null || value === "")) {
      issues.push({ path: [field.name], message: `${field.name} is required` });
      continue;
    }

    const isZodSchema =
      field.validate !== undefined &&
      typeof field.validate === "object" &&
      typeof (field.validate as { safeParse?: unknown }).safeParse === "function";
    if (isZodSchema && value !== undefined) {
      const result = (field.validate as z.ZodTypeAny).safeParse(value);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const sub = issue.path.map((p) => (typeof p === "symbol" ? p.toString() : p));
          issues.push({ path: [field.name, ...sub], message: issue.message });
        }
      }
    }
  }

  return issues.length > 0 ? issues : null;
}
