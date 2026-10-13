import type {
  ActionResult,
  AuditEvent,
  FieldDef,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { mergeLabels, reportUnexpectedError, runWithRequestContext } from "@flowpanel/core";
import { isAuditActive } from "@flowpanel/core/internal";
import type { z } from "zod";
import { choiceErrors } from "../actions/field-choices";
import { actionFailure, validationFailure } from "./action-failure";
import {
  actorIdFromSession,
  buildActionContext,
  buildAuditEvent,
  computeShallowDiff,
  invalidJsonResponse,
  maybeEmitAudit,
  notFoundResponse,
  readActionInput,
} from "./action-helpers";
import { parseActionInputSchema, validateActionOutput } from "./action-schema";
import { type ApplyActionResultOptions, applyActionResult } from "./apply-action-result";
import { resolveRowProjection } from "./project-row";
import { bindPublisher } from "./publish";
import { type GuardFrame, type GuardSpec, withResolvedGuards } from "./with-guards";

type Params = Record<string, string>;

export interface Resolved<Target> {
  spec: GuardSpec;
  target: Target;
}

export interface GuardedRoute<P extends Params, Target> extends GuardFrame {
  /** The target the URL names, looked up only after the caller is identified; a `Response` answers instead. */
  resolve: (params: P) => Resolved<Target> | Response;
  /** Input parsing, the entry point's own work and its response shape. */
  handle: (args: {
    req: Request;
    reqCtx: RequestContext;
    target: Target;
    params: P;
  }) => Promise<Response>;
}

/** Every write entry point: guards, then the target, then its access rules, then `handle`. */
export function guardedRoute<P extends Params, Target>(
  config: ResolvedAdminConfig,
  route: GuardedRoute<P, Target>,
): (req: Request, ctx: { params: Promise<P> }) => Promise<Response> {
  bindPublisher(config);
  return async (req, ctx) => {
    const params = await ctx.params;
    return withResolvedGuards(
      config,
      req,
      route,
      () => route.resolve(params),
      (reqCtx, target) => route.handle({ req, reqCtx, target, params }),
    );
  };
}

/** The resource a route names, or a 404 that lists the registered names in development. */
export function lookupResource(
  config: ResolvedAdminConfig,
  name: string,
): ResourceConfig | Response {
  return (
    config.resourcesByName.get(name) ??
    notFoundResponse("resource", name, [...config.resourcesByName.keys()])
  );
}

/** The action a route names among `actions`, or a 404. */
export function lookupAction<Action extends { key: string }>(
  actions: readonly Action[] | undefined,
  key: string,
): Action | Response {
  return (
    actions?.find((action) => action.key === key) ??
    notFoundResponse(
      "action",
      key,
      (actions ?? []).map((action) => action.key),
    )
  );
}

export function rowNotFound(): Response {
  return actionFailure("not_found", "not found");
}

/** A before/after diff the audit sink may keep: readable fields only, `sensitive` ones never. */
export async function auditDiff(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  reqCtx: RequestContext,
  extraFields: Iterable<string> = [],
): Promise<AuditEvent["diff"] | undefined> {
  const secret = new Set(
    config.adapter
      .introspect(resource.ref)
      .columns.filter((column) => column.sensitive)
      .map((column) => column.name),
  );
  const readable = (await resolveRowProjection(resource, reqCtx, extraFields)).filter(
    (field) => !secret.has(field),
  );
  const project = (row: Record<string, unknown> | null) =>
    row === null
      ? null
      : Object.fromEntries(readable.filter((f) => f in row).map((f) => [f, row[f]]));
  return computeShallowDiff(project(before), project(after));
}

export interface WriteEffects {
  audit: {
    action: string;
    resource?: string;
    targetId?: string;
    targetIds?: readonly string[];
    /** Resolved only when an audit sink is listening. */
    diff?: () => Promise<AuditEvent["diff"] | undefined>;
  };
  /** The resource's `audit: false` opt-out, when the write belongs to one. */
  resourceAudit?: boolean | undefined;
  publish: ApplyActionResultOptions;
}

/** The write already committed, so a failed re-read costs only the diff, never the audit event. */
async function diffOrNone(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  diff: () => Promise<AuditEvent["diff"] | undefined>,
): Promise<AuditEvent["diff"] | undefined> {
  try {
    return await diff();
  } catch (error) {
    await reportUnexpectedError(
      error,
      {
        requestId: reqCtx.requestId ?? "audit",
        route: "audit-diff",
        method: reqCtx.req.method,
        url: reqCtx.req.url,
        actorId: actorIdFromSession(reqCtx.session, config.auth.userId),
        ip: reqCtx.ip,
        userAgent: reqCtx.userAgent,
      },
      config.hooks?.onError,
    );
    return undefined;
  }
}

/** After a successful write: one audit event with the real actor, then realtime and revalidation. */
export async function commitEffects(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  result: ActionResult<unknown>,
  effects: WriteEffects,
): Promise<void> {
  if (!result.ok) return;
  const { diff, ...audit } = effects.audit;
  const resolvedDiff =
    diff && isAuditActive(config, effects.resourceAudit)
      ? await diffOrNone(config, reqCtx, diff)
      : undefined;
  await maybeEmitAudit(
    result,
    config,
    effects.resourceAudit,
    buildAuditEvent(config, reqCtx, {
      ...audit,
      ...(resolvedDiff !== undefined ? { diff: resolvedDiff } : {}),
    }),
  );
  await applyActionResult(result, effects.publish);
}

interface DeclaredAction {
  form?: unknown;
  inputSchema?: z.ZodTypeAny | undefined;
  outputSchema?: z.ZodTypeAny | undefined;
  unsafe?: readonly "db"[];
}

/** The posted input checked against the action's form, its choices and schema, or the 422 that answers it. */
export async function parseDeclaredInput(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  action: DeclaredAction,
  input: Record<string, unknown>,
): Promise<Record<string, unknown> | Response> {
  const form = action.form as FieldDef<Record<string, unknown>>[] | undefined;
  const labels = mergeLabels(config.labels);
  const parsed = await parseActionInputSchema(form, action.inputSchema, input, labels);
  if (parsed.issues) return validationFailure(parsed.issues, reqCtx.requestId);
  const fieldErrors = await choiceErrors(
    config,
    undefined,
    form,
    parsed.data,
    null,
    reqCtx,
    labels,
  );
  if (!fieldErrors) return parsed.data;
  return actionFailure("validation_failed", "Validation failed", {
    fieldErrors,
    ...(reqCtx.requestId ? { requestId: reqCtx.requestId } : {}),
  });
}

type Invoke = (
  input: Record<string, unknown>,
  ctx: ReturnType<typeof buildActionContext>,
) => Promise<ActionResult<unknown>> | ActionResult<unknown>;

/** The action context, `invoke`, the output checked against `outputSchema`, then `commitEffects`. */
export async function invokeDeclaredAction(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  action: DeclaredAction,
  input: Record<string, unknown>,
  invoke: Invoke,
  effects: WriteEffects,
): Promise<Response> {
  const actionCtx = buildActionContext(config, reqCtx, action);
  const result = validateActionOutput(
    action.outputSchema,
    await runWithRequestContext(reqCtx, () => invoke(input, actionCtx)),
  );
  await commitEffects(config, reqCtx, result, effects);
  return Response.json(result);
}

/** A declared action's whole run: input, then `invokeDeclaredAction`. */
export async function runDeclaredAction(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  action: DeclaredAction,
  input: Record<string, unknown>,
  invoke: Invoke,
  effects: WriteEffects,
): Promise<Response> {
  const parsed = await parseDeclaredInput(config, reqCtx, action, input);
  if (parsed instanceof Response) return parsed;
  return invokeDeclaredAction(config, reqCtx, action, parsed, invoke, effects);
}

/** The posted action body, or the 400 that answers a malformed one. */
export async function readActionBody(req: Request): Promise<Record<string, unknown> | Response> {
  const body = await readActionInput(req);
  return body.ok ? body.input : invalidJsonResponse(body.reason);
}
