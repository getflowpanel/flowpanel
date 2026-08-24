import type {
  AccessRule,
  ActionResult,
  AuditConfig,
  AuditEvent,
  FieldDef,
  RequestContext,
  RequireRole,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  accessAllows,
  checkRequireRole,
  emitAudit,
  FlowpanelUnknownFieldError,
} from "@flowpanel/core";
import type { z } from "zod";
import { parseActionBody } from "../drawer/parse-action-body.js";
import { requireAuthorized } from "./require-authorized.js";

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
 * 404 for an unknown route target. Development names what was asked for and
 * what is registered; production stays terse so the response leaks nothing.
 */
export function notFoundResponse(
  kind: "resource" | "action" | "dashboard",
  requested: string,
  registered: readonly string[],
): Response {
  const terse = `${kind} not found`;
  if (process.env.NODE_ENV === "production") {
    return Response.json({ ok: false, error: terse }, { status: 404 });
  }
  const known = registered.length > 0 ? registered.map((n) => `"${n}"`).join(", ") : "(none)";
  return Response.json(
    { ok: false, error: `${terse}: "${requested}". Registered ${kind}s: ${known}.` },
    { status: 404 },
  );
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

/** Keep only actions the current operator is authorized to execute. */
export function filterActionsByRole<Action extends { requireRole?: RequireRole }>(
  actions: readonly Action[] | undefined,
  reqCtx: RequestContext,
): Action[] {
  return (actions ?? []).filter((action) => roleAllows(action.requireRole, reqCtx));
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

export interface ActionInputIssue {
  path: (string | number)[];
  message: string;
}

function isPromiseLike(v: unknown): v is PromiseLike<string | null> {
  return (
    typeof v === "object" && v !== null && typeof (v as { then?: unknown }).then === "function"
  );
}

/**
 * Validate a client-supplied action `input` against the action's declared `form` (a `FieldDef[]`).
 * Returns a plain result unless a function-form `validate` is itself async, in which case it
 * returns a `Promise` — callers with only sync validators can skip `await` and still get it right.
 */
export function validateActionInput(
  form: FieldDef<Record<string, unknown>>[] | undefined,
  input: unknown,
): ActionInputIssue[] | null | Promise<ActionInputIssue[] | null> {
  if (!form || form.length === 0) return null;

  const values =
    input && typeof input === "object" ? (input as Record<string, unknown>) : undefined;
  if (values === undefined) {
    return [{ path: [], message: "input must be an object" }];
  }

  const issues: ActionInputIssue[] = [];
  const pending: { name: string; result: PromiseLike<string | null> }[] = [];

  for (const field of form) {
    const value = values[field.name];

    if (field.required && (value === undefined || value === null || value === "")) {
      issues.push({ path: [field.name], message: `${field.name} is required` });
      continue;
    }
    if (field.validate === undefined || value === undefined) continue;

    if (typeof field.validate === "function") {
      const result = field.validate(value, values);
      if (isPromiseLike(result)) {
        pending.push({ name: field.name, result });
      } else if (result) {
        issues.push({ path: [field.name], message: result });
      }
    } else if (typeof (field.validate as { safeParse?: unknown }).safeParse === "function") {
      const result = (field.validate as z.ZodTypeAny).safeParse(value);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const sub = issue.path.map((p) => (typeof p === "symbol" ? p.toString() : p));
          issues.push({ path: [field.name, ...sub], message: issue.message });
        }
      }
    }
  }

  if (pending.length === 0) return issues.length > 0 ? issues : null;

  return (async () => {
    for (const { name, result } of pending) {
      const msg = await result;
      if (msg) issues.push({ path: [name], message: msg });
    }
    return issues.length > 0 ? issues : null;
  })();
}

/** Action inputs are an allowlist too; unknown keys never reach trusted callbacks. */
export function assertActionInputFields(
  form: FieldDef<Record<string, unknown>>[] | undefined,
  input: Record<string, unknown>,
  inputSchema?: z.ZodTypeAny,
): void {
  const shape = (inputSchema as { shape?: Record<string, unknown> } | undefined)?.shape;
  const allowed = new Set([
    ...(form ?? []).map((field) => field.name),
    ...Object.keys(shape ?? {}),
  ]);
  for (const field of Object.keys(input)) {
    if (!allowed.has(field)) throw new FlowpanelUnknownFieldError(field);
  }
}

export interface ParsedActionInput {
  data: Record<string, unknown>;
  issues: ActionInputIssue[] | null;
}

/** Validate field rules and the optional cross-field action schema once. */
export async function parseActionInputSchema(
  form: FieldDef<Record<string, unknown>>[] | undefined,
  inputSchema: z.ZodTypeAny | undefined,
  input: Record<string, unknown>,
): Promise<ParsedActionInput> {
  assertActionInputFields(form, input, inputSchema);
  const fieldIssues = await validateActionInput(form, input);
  if (fieldIssues) return { data: input, issues: fieldIssues };
  if (!inputSchema) return { data: input, issues: null };
  const parsed = inputSchema.safeParse(input);
  if (parsed.success) return { data: parsed.data as Record<string, unknown>, issues: null };
  return {
    data: input,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.map((part) => (typeof part === "symbol" ? part.toString() : part)),
      message: issue.message,
    })),
  };
}

/** Ensure arbitrary success data is declared and safe before it crosses the wire. */
export function validateActionOutput(
  outputSchema: z.ZodTypeAny | undefined,
  result: ActionResult<unknown>,
): ActionResult<unknown> {
  if (!result.ok || result.data === undefined) return result;
  if (!outputSchema) {
    throw new Error("An action returned data without declaring outputSchema.");
  }
  const parsed = outputSchema.safeParse(result.data);
  if (!parsed.success) throw new Error("An action returned data that failed outputSchema.");
  return { ...result, data: parsed.data };
}
