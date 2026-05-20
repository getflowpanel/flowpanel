import {
  assertResourceScope,
  checkRequireRole,
  type RequestContext,
  type ResolvedAdminConfig,
  type ResourceConfig,
} from "@flowpanel/core";

/**
 * Runs the resource's role + scope checks. Throws FlowpanelAccessError on
 * failure. Call once at the top of every resource-bound handler.
 */
export function requireAuthorized(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
): void {
  checkRequireRole(resource.options.requireRole, reqCtx.role, reqCtx.session);
  assertResourceScope({
    hasGlobal: !!config.scope,
    // ResourceOptions.scope is typed `(scope: Scope, query: unknown) => unknown`,
    // which is contravariantly incompatible with `(...args: unknown[]) => unknown`.
    // The runtime check is `typeof === "function"`, so the widening is safe.
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });
}
