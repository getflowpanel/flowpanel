import type {
  RequestContext,
  RequireRole,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { checkRequireRole } from "@flowpanel/core";
import {
  guardActionRole,
  guardResourceAccess,
  guardWritable,
  safeErrorMessage,
} from "./action-helpers.js";
import { buildRequestContext } from "./request-setup.js";

export interface GuardSpec {
  resource?: ResourceConfig | undefined;
  pageRequireRole?: RequireRole;
  actionRequireRole?: string | string[] | undefined;
  /** Read-only routes pass `false` so `config.readOnly` does not block them. */
  write?: boolean;
}

function hasFlowpanelErrorShape(err: unknown): err is { status: number; safeMessage: string } {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: unknown; safeMessage?: unknown };
  return typeof e.status === "number" && typeof e.safeMessage === "string" && e.safeMessage !== "";
}

function errorResponse(err: unknown): Response {
  if (hasFlowpanelErrorShape(err)) {
    return Response.json({ ok: false, error: err.safeMessage }, { status: err.status });
  }
  return Response.json({ ok: false, error: safeErrorMessage(err) }, { status: 500 });
}

function forbidden(err: unknown): Response {
  return Response.json({ ok: false, error: safeErrorMessage(err, "forbidden") }, { status: 403 });
}

export async function withGuards(
  config: ResolvedAdminConfig,
  req: Request,
  spec: GuardSpec,
  handler: (reqCtx: RequestContext) => Promise<Response>,
): Promise<Response> {
  let reqCtx: RequestContext;
  try {
    reqCtx = await buildRequestContext({ req, config });
  } catch (err) {
    return errorResponse(err);
  }

  if (spec.write !== false) {
    const writeGuard = guardWritable(config);
    if (writeGuard) return writeGuard;
  }

  if (spec.resource) {
    const resourceGuard = guardResourceAccess(config, spec.resource, reqCtx);
    if (resourceGuard) return resourceGuard;
  }

  if (spec.pageRequireRole !== undefined) {
    try {
      checkRequireRole(spec.pageRequireRole, reqCtx.role, reqCtx.session);
    } catch (err) {
      return forbidden(err);
    }
  }

  const roleGuard = guardActionRole(spec.actionRequireRole, reqCtx);
  if (roleGuard) return roleGuard;

  try {
    return await handler(reqCtx);
  } catch (err) {
    return errorResponse(err);
  }
}
