import type {
  AccessRule,
  ErrorContext,
  RequestContext,
  RequireRole,
  ResolvedAdminConfig,
  ResourceConfig,
  ResourceOperation,
} from "@flowpanel/core";
import {
  authorizeOperation,
  checkRequireRole,
  errorResult as coreErrorResult,
  FlowpanelAccessError,
  FlowpanelError,
  FlowpanelOperationDisabledError,
  reportUnexpectedError,
  resolveOperationAccess,
} from "@flowpanel/core";
import { actorIdFromSession } from "./action-helpers";
import { buildRequestContext, requestIdFrom } from "./request-setup";
import { requireAuthorized } from "./require-authorized";

export interface GuardSpec {
  resource?: ResourceConfig | undefined;
  pageRequireRole?: RequireRole | undefined;
  actionRequireRole?: string | string[] | undefined;
  actionAccess?: AccessRule | undefined;
  operation?: ResourceOperation | undefined;
  route?: string | undefined;
  /** Read-only routes pass `false` so `config.readOnly` does not block them. */
  write?: boolean | undefined;
  /**
   * Which body this route speaks. Routes answering with `Result` — the JSON API and the
   * programmatic controllers — must fail in that envelope too, or `@flowpanel/client`
   * reads every guard rejection as an unrecognised response. Action and form routes
   * answer with `ActionResult`, whose `error` is the operator-facing message.
   */
  envelope?: "result" | undefined;
}

function errorResponse(
  err: unknown,
  requestId: string,
  envelope?: GuardSpec["envelope"],
): Response {
  const result = coreErrorResult(err, requestId);
  if (result.ok) throw new Error("errorResult unexpectedly returned success");
  const status = err instanceof FlowpanelError ? err.status : 500;
  const headers = { "x-request-id": requestId };
  if (envelope === "result") return Response.json(result, { status, headers });
  const { code, message, fieldErrors } = result.error;
  return Response.json(
    {
      ok: false,
      error: message,
      code,
      requestId,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
    { status, headers },
  );
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

  const requestOrigin = new URL(req.url).origin;
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
  // Header-less requests remain available to trusted server-to-server clients.
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse(new FlowpanelAccessError(CROSS_ORIGIN_ERROR), requestId, envelope);
  }
  return null;
}

export async function withGuards(
  config: ResolvedAdminConfig,
  req: Request,
  spec: GuardSpec,
  handler: (reqCtx: RequestContext) => Promise<Response>,
): Promise<Response> {
  const requestId = requestIdFrom(req);
  if (spec.write !== false) {
    const originGuard = guardSameOrigin(config, req, requestId, spec.envelope);
    if (originGuard) return originGuard;
  }

  let reqCtx: RequestContext;
  try {
    reqCtx = await buildRequestContext({ req, config, requestId });
  } catch (err) {
    const context = errorContext(req, requestId, spec);
    await reportUnexpectedError(err, context, config.hooks?.onError);
    return errorResponse(err, requestId, spec.envelope);
  }

  if (spec.write !== false) {
    if (config.readOnly) {
      return errorResponse(
        new FlowpanelOperationDisabledError("This admin is read-only."),
        requestId,
        spec.envelope,
      );
    }
  }

  if (spec.resource) {
    try {
      requireAuthorized(config, spec.resource, reqCtx);
    } catch (err) {
      return errorResponse(err, requestId, spec.envelope);
    }
    // Action routes set no operation. An action that carries its own rule is governed
    // by it — the same rule that decides whether the action is offered at all. An
    // action that carries none inherits the resource's write rule instead of running
    // ungated, which is what a resource using the canonical `access` map would do.
    const actionCarriesOwnRule =
      spec.actionAccess !== undefined || spec.actionRequireRole !== undefined;
    const operation = spec.operation ?? (actionCarriesOwnRule ? undefined : "update");
    if (operation) {
      try {
        const rule = resolveOperationAccess(
          spec.resource.options.access,
          spec.resource.options.requireRole,
          operation,
        );
        await authorizeOperation(rule, reqCtx);
      } catch (err) {
        return errorResponse(err, requestId, spec.envelope);
      }
    }
  }

  if (spec.pageRequireRole !== undefined) {
    try {
      checkRequireRole(spec.pageRequireRole, reqCtx.role, reqCtx.session);
    } catch (err) {
      return errorResponse(err, requestId, spec.envelope);
    }
  }

  if (spec.actionAccess !== undefined && spec.actionRequireRole !== undefined) {
    return errorResponse(
      new Error("An action cannot declare both access and requireRole."),
      requestId,
    );
  }
  if (spec.actionAccess !== undefined) {
    try {
      await authorizeOperation(spec.actionAccess, reqCtx);
    } catch (err) {
      return errorResponse(err, requestId, spec.envelope);
    }
  } else {
    try {
      checkRequireRole(spec.actionRequireRole, reqCtx.role, reqCtx.session);
    } catch (err) {
      return errorResponse(err, requestId, spec.envelope);
    }
  }

  try {
    return await handler(reqCtx);
  } catch (err) {
    const context = errorContext(req, requestId, spec, reqCtx);
    await reportUnexpectedError(err, context, config.hooks?.onError);
    return errorResponse(err, requestId, spec.envelope);
  }
}

function errorContext(
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
    actorId: reqCtx ? actorIdFromSession(reqCtx.session) : null,
    ip: reqCtx?.ip ?? null,
    userAgent: reqCtx?.userAgent ?? req.headers.get("user-agent"),
  };
}
