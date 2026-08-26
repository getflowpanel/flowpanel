import type {
  AccessRule,
  ActionResult,
  AuditConfig,
  AuditEvent,
  RequestContext,
  RequireRole,
} from "@flowpanel/core";
import { accessAllows, checkRequireRole, emitAudit } from "@flowpanel/core";
import { parseActionBody } from "../drawer/parse-action-body";

/** Body of a POSTed action, or a flag that the JSON was malformed. */
export type ActionInput =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; reason: "invalid-json" };

/** Like `parseActionBody`, but a malformed JSON body is reported instead of swallowed. */
export async function readActionInput(req: Request): Promise<ActionInput> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const parsed = (await req.json()) as Record<string, unknown> | null;
      return { ok: true, input: parsed ?? {} };
    } catch {
      return { ok: false, reason: "invalid-json" };
    }
  }
  return { ok: true, input: await parseActionBody(req) };
}

export function invalidJsonResponse(): Response {
  return Response.json({ ok: false, error: "invalid JSON body" }, { status: 400 });
}

/**
 * 404 for an unknown route target. These run before the guards, so the body stays
 * terse in every environment and development gets the registry on the server log.
 */
export function notFoundResponse(
  kind: "resource" | "action" | "dashboard",
  requested: string,
  registered: readonly string[],
): Response {
  if (process.env.NODE_ENV !== "production") {
    const known = registered.length > 0 ? registered.map((n) => `"${n}"`).join(", ") : "(none)";
    console.warn(`[flowpanel] ${kind} not found: "${requested}". Registered ${kind}s: ${known}.`);
  }
  return Response.json({ ok: false, error: `${kind} not found` }, { status: 404 });
}

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

/** Keep only actions allowed by canonical `access` or its `requireRole` alias. */
export async function filterActionsByAccess<
  Action extends { access?: AccessRule | undefined; requireRole?: RequireRole },
>(actions: readonly Action[] | undefined, reqCtx: RequestContext): Promise<Action[]> {
  const visible: Action[] = [];
  for (const action of actions ?? []) {
    if (action.access !== undefined) {
      if (await accessAllows(action.access, reqCtx)) visible.push(action);
    } else if (roleAllows(action.requireRole, reqCtx)) {
      visible.push(action);
    }
  }
  return visible;
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
  result: ActionResult<unknown>,
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
