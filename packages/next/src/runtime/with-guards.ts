import type { ErrorContext, RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import {
  errorResult as coreErrorResult,
  FlowpanelAccessError,
  FlowpanelError,
  FlowpanelOperationDisabledError,
  reportUnexpectedError,
} from "@flowpanel/core";
import { actionFailure, withRequestId } from "./action-failure";
import { requireTargetRules, type TargetAccess } from "./action-gate";
import { actorIdFromSession } from "./action-helpers";
import { browserOrigin } from "./request-origin";
import { buildRequestContext, requestIdFrom } from "./request-setup";
import { requireAuthorized } from "./require-authorized";

export interface GuardFrame {
  route?: string | undefined;
  /** Read-only routes pass `false` so `config.readOnly` does not block them. */
  write?: boolean | undefined;
  /**
   * Which body this route speaks. `Result` routes must fail in that envelope too, or `@flowpanel/client`
   * reads every guard rejection as unrecognised; action/form routes answer with `ActionResult`.
   */
  envelope?: "result" | undefined;
}

/** The rules a route's target sets, checked after the caller is identified. */
export interface GuardSpec extends GuardFrame, TargetAccess {}

function errorResponse(
  err: unknown,
  requestId: string,
  envelope?: GuardSpec["envelope"],
): Response {
  const result = coreErrorResult(err, requestId);
  if (result.ok) throw new Error("errorResult unexpectedly returned success");
  const status = err instanceof FlowpanelError ? err.status : 500;
  if (envelope === "result") {
    return Response.json(result, { status, headers: { "x-request-id": requestId } });
  }
  const { code, message, fieldErrors } = result.error;
  return actionFailure(code, message, {
    status,
    requestId,
    ...(fieldErrors ? { fieldErrors } : {}),
  });
}

const CROSS_ORIGIN_ERROR = "Cross-origin write requests are not allowed.";

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function guardSameOrigin(
  config: ResolvedAdminConfig,
  req: Request,
  requestId: string,
  envelope?: GuardSpec["envelope"],
): Response | null {
  if (config.security?.sameOrigin === false) return null;

  const requestOrigin = browserOrigin(req);
  const originHeader = req.headers.get("origin");
  if (originHeader !== null) {
    const origin = normalizeOrigin(originHeader);
    const trusted = new Set<string>([requestOrigin]);
    for (const candidate of config.security?.trustedOrigins ?? []) {
      const normalized = normalizeOrigin(candidate);
      if (normalized) trusted.add(normalized);
    }
    if (origin !== null && trusted.has(origin)) return null;
    return errorResponse(new FlowpanelAccessError(CROSS_ORIGIN_ERROR), requestId, envelope);
  }

  // Modern browsers send Fetch Metadata even when Origin is unavailable.
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse(new FlowpanelAccessError(CROSS_ORIGIN_ERROR), requestId, envelope);
  }
  return null;
}

/** Origin, identity, `readOnly`, then the target the URL names, then its access rules, then `handler`. */
export async function withResolvedGuards<Target>(
  config: ResolvedAdminConfig,
  req: Request,
  frame: GuardFrame,
  resolve: (reqCtx: RequestContext) => { spec: GuardSpec; target: Target } | Response,
  handler: (reqCtx: RequestContext, target: Target) => Promise<Response>,
): Promise<Response> {
  const requestId = requestIdFrom(req);
  if (frame.write !== false) {
    const originGuard = guardSameOrigin(config, req, requestId, frame.envelope);
    if (originGuard) return originGuard;
  }

  let reqCtx: RequestContext;
  try {
    reqCtx = await buildRequestContext({ req, config, requestId });
  } catch (err) {
    const context = errorContext(config, req, requestId, frame);
    await reportUnexpectedError(err, context, config.hooks?.onError);
    return errorResponse(err, requestId, frame.envelope);
  }

  if (frame.write !== false && config.readOnly) {
    return errorResponse(
      new FlowpanelOperationDisabledError("This admin is read-only."),
      requestId,
      frame.envelope,
    );
  }

  const resolved = resolve(reqCtx);
  if (resolved instanceof Response) {
    return frame.envelope === "result" ? resolved : withRequestId(resolved, requestId);
  }
  const { spec, target } = resolved;

  try {
    await requireTargetAccess(config, spec, reqCtx);
  } catch (err) {
    return errorResponse(err, requestId, frame.envelope);
  }

  try {
    const res = await handler(reqCtx, target);
    return frame.envelope === "result" ? res : await withRequestId(res, requestId);
  } catch (err) {
    const context = errorContext(config, req, requestId, { ...frame, ...spec }, reqCtx);
    await reportUnexpectedError(err, context, config.hooks?.onError);
    return errorResponse(err, requestId, frame.envelope);
  }
}

async function requireTargetAccess(
  config: ResolvedAdminConfig,
  spec: GuardSpec,
  reqCtx: RequestContext,
): Promise<void> {
  if (spec.resource) requireAuthorized(config, spec.resource);
  await requireTargetRules(spec, reqCtx);
}

export function withGuards(
  config: ResolvedAdminConfig,
  req: Request,
  spec: GuardSpec,
  handler: (reqCtx: RequestContext) => Promise<Response>,
): Promise<Response> {
  return withResolvedGuards(
    config,
    req,
    spec,
    () => ({ spec, target: undefined }),
    (reqCtx) => handler(reqCtx),
  );
}

function errorContext(
  config: ResolvedAdminConfig,
  req: Request,
  requestId: string,
  spec: GuardSpec,
  reqCtx?: RequestContext,
): ErrorContext {
  return {
    requestId,
    ...(spec.operation ? { operation: spec.operation } : {}),
    ...(spec.route ? { route: spec.route } : {}),
    method: req.method,
    url: req.url,
    actorId: reqCtx ? actorIdFromSession(reqCtx.session, config.auth.userId) : null,
    ip: reqCtx?.ip ?? null,
    userAgent: reqCtx?.userAgent ?? req.headers.get("user-agent"),
  };
}
