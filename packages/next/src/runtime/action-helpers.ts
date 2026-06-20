import type {
  ActionResult,
  AuditConfig,
  AuditEvent,
  FieldDef,
  RequestContext,
  RequireRole,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { checkRequireRole, emitAudit } from "@flowpanel/core";
import type { z } from "zod";
import { requireAuthorized } from "./require-authorized.js";

function idString(id: unknown): string | null {
  return id === undefined || id === null || id === "" ? null : String(id);
}

export function actorIdFromSession(
  session: RequestContext["session"],
  extractUserId?: (session: RequestContext["session"]) => string | null,
): string | null {
  if (extractUserId) {
    try {
      return idString(extractUserId(session));
    } catch {
      return null;
    }
  }
  if (!session || typeof session !== "object") return null;
  const top = idString((session as { id?: unknown }).id);
  if (top !== null) return top;
  const user = (session as { user?: unknown }).user;
  if (user && typeof user === "object" && "id" in user) {
    return idString((user as { id?: unknown }).id);
  }
  return null;
}

export function guardResourceAccess(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
): Response | null {
  try {
    requireAuthorized(config, resource, reqCtx);
    return null;
  } catch (err) {
    return Response.json({ ok: false, error: safeErrorMessage(err, "forbidden") }, { status: 403 });
  }
}

/** Non-throwing role check, used for field-level RBAC (`FieldDef.requireRole`). */
export function roleAllows(requireRole: RequireRole | undefined, reqCtx: RequestContext): boolean {
  if (requireRole === undefined) return true;
  try {
    checkRequireRole(requireRole, reqCtx.role, reqCtx.session);
    return true;
  } catch {
    return false;
  }
}

/** Block every write when the admin is globally read-only (`config.readOnly`). */
export function guardWritable(config: ResolvedAdminConfig): Response | null {
  if (config.readOnly) {
    return Response.json({ ok: false, error: "This admin is read-only." }, { status: 403 });
  }
  return null;
}

/** Per-action `requireRole` guard. */
export function guardActionRole(
  requiredRole: string | string[] | undefined,
  reqCtx: RequestContext,
): Response | null {
  if (requiredRole === undefined) return null;
  try {
    checkRequireRole(requiredRole, reqCtx.role, reqCtx.session);
    return null;
  } catch (err) {
    return Response.json({ ok: false, error: safeErrorMessage(err, "forbidden") }, { status: 403 });
  }
}

/** Build the standard `AuditEvent` shape every action handler emits. */
export function buildAuditEvent(
  reqCtx: RequestContext,
  base: { action: string; resource?: string; targetId?: string; diff?: AuditEvent["diff"] },
  extractUserId?: (session: RequestContext["session"]) => string | null,
): AuditEvent {
  return {
    actorId: actorIdFromSession(reqCtx.session, extractUserId),
    action: base.action,
    at: new Date(),
    ...(base.resource !== undefined ? { resource: base.resource } : {}),
    ...(base.targetId !== undefined ? { targetId: base.targetId } : {}),
    ...(base.diff !== undefined ? { diff: base.diff } : {}),
    ...(reqCtx.ip ? { ip: reqCtx.ip } : {}),
    ...(reqCtx.userAgent ? { userAgent: reqCtx.userAgent } : {}),
  };
}

/** Wrap an action handler's success branch with the audit emit. */
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

export function isAuditActive(
  auditConfig: AuditConfig | undefined,
  resourceAudit: boolean | undefined,
): boolean {
  if (resourceAudit === false) return false;
  return Boolean(auditConfig?.sink);
}

/** Shallow before/after diff for an auto-audited mutation. */
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

/** Derive a client-safe error message from a thrown value. */
export function safeErrorMessage(err: unknown, fallback = "internal error"): string {
  if (err && typeof err === "object" && "safeMessage" in err) {
    const safe = (err as { safeMessage?: unknown }).safeMessage;
    if (typeof safe === "string" && safe) return safe;
  }
  return fallback;
}

export interface ActionInputIssue {
  path: (string | number)[];
  message: string;
}

/** Validate a client-supplied action `input` against the action's declared `form` (a `FieldDef[]`). */
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
