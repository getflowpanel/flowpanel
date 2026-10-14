import type {
  ActionResult,
  AuditEvent,
  RequestContext,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { isAllTenants } from "@flowpanel/core";
import { emitAudit } from "@flowpanel/core/internal";
import { accountUser } from "./account-user";
import { actionFailure } from "./action-failure";
import { publish } from "./publish";
import { type RequestBodyError, readActionObject, requestBodyErrorResponse } from "./request-body";

/** Body of a POSTed action, or a flag that the JSON was malformed. */
export type ActionInput =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; reason: RequestBodyError };

/** Read an action body without discarding parse errors. */
export async function readActionInput(req: Request): Promise<ActionInput> {
  const parsed = await readActionObject(req);
  return parsed.ok ? { ok: true, input: parsed.value } : parsed;
}

export function invalidJsonResponse(reason: RequestBodyError = "invalid-json"): Response {
  return requestBodyErrorResponse(reason);
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
  return actionFailure("not_found", `${kind} not found`);
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

/** The context every action's `run` receives: request, actor, publisher, and `unsafe.db` when declared. */
export function buildActionContext(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  action: { unsafe?: readonly "db"[] },
) {
  return {
    ...reqCtx,
    ...(action.unsafe?.includes("db") ? { unsafe: { db: config.adapter.db } } : {}),
    actorId: actorIdFromSession(reqCtx.session, config.auth.userId),
    publish: async (channel: string, payload?: unknown) => {
      await publish(channel, payload);
    },
  };
}

type AuditBase = Pick<AuditEvent, "action" | "resource" | "targetId" | "targetIds" | "diff">;

function actorName(config: ResolvedAdminConfig, session: RequestContext["session"]): string | null {
  try {
    const user = accountUser(config, session);
    return user?.name ?? user?.email ?? null;
  } catch {
    return null;
  }
}

/** Build the standard `AuditEvent` shape every action handler emits. */
export function buildAuditEvent(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  base: AuditBase,
): AuditEvent {
  const name = actorName(config, reqCtx.session);
  return {
    actorId: actorIdFromSession(reqCtx.session, config.auth.userId),
    action: base.action,
    at: new Date(),
    ...(name ? { actorName: name } : {}),
    ...(base.resource !== undefined ? { resource: base.resource } : {}),
    ...(base.targetId !== undefined ? { targetId: base.targetId } : {}),
    ...(base.targetIds !== undefined ? { targetIds: base.targetIds } : {}),
    ...(base.diff !== undefined ? { diff: base.diff } : {}),
    ...(reqCtx.scope && !isAllTenants(reqCtx.scope) ? { scope: reqCtx.scope } : {}),
    ...(reqCtx.ip ? { ip: reqCtx.ip } : {}),
    ...(reqCtx.userAgent ? { userAgent: reqCtx.userAgent } : {}),
  };
}

/** Wrap an action handler's success branch with the audit emit. */
export async function maybeEmitAudit(
  result: ActionResult<unknown>,
  config: ResolvedAdminConfig,
  resourceAudit: boolean | undefined,
  event: AuditEvent,
): Promise<void> {
  if (!result.ok || resourceAudit === false) return;
  await emitAudit(config, event);
}

function jsonOf(value: object): string | null {
  try {
    return JSON.stringify(value, (_key, inner: unknown) =>
      typeof inner === "bigint" ? inner.toString() : inner,
    );
  } catch {
    return null;
  }
}

/** A re-submitted form hands back equal values in new objects: a date or JSON value that reads the same is no change. */
function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a && b && typeof a === "object" && typeof b === "object") {
    const left = jsonOf(a);
    return left !== null && left === jsonOf(b);
  }
  return false;
}

/** Field-by-field before/after diff for an auto-audited mutation. */
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
    if (!sameValue(before[key], after[key])) {
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
