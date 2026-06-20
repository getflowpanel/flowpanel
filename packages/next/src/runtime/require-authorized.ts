import {
  assertResourceScope,
  checkRequireRole,
  type RequestContext,
  type ResolvedAdminConfig,
  type ResourceConfig,
} from "@flowpanel/core";

/** Runs the resource's role + scope checks. */
export function requireAuthorized(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
): void {
  checkRequireRole(resource.options.requireRole, reqCtx.role, reqCtx.session);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });
}
