import type { BoundAdapterScope, RequestContext, ResourceConfig } from "@flowpanel/core";
import { bindAdapterScope } from "@flowpanel/core";

/** Result of binding a resource's tenant-scope predicate to a request. */
export interface ScopeBinding {
  /** The resource's `scope` with the request's scope value already captured. */
  boundScope?: BoundAdapterScope;
}

/** Bind `resource.options.scope` to `reqCtx.scope` for a single request. */
export function scopeBinding(resource: ResourceConfig, reqCtx: RequestContext): ScopeBinding {
  const resourceScope = resource.options.scope;
  if (typeof resourceScope !== "function") return {};
  const scopeValue = reqCtx.scope;
  const predicate = resourceScope as (scope: unknown, query: unknown) => unknown;
  return { boundScope: bindAdapterScope((query: unknown) => predicate(scopeValue, query)) };
}
