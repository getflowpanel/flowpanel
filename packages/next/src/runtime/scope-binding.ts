import type {
  BoundAdapterScope,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { bindAdapterScope } from "@flowpanel/core";

/** Result of binding a resource's tenant-scope predicate to a request. */
export interface ScopeBinding {
  /** Opaque v2 scope binding consumed by shipped adapters. */
  boundScope?: BoundAdapterScope;
  /** Pre-bound scope predicate: the request's `scope` value is already captured. */
  applyScope?: (query: unknown) => unknown;
  /** `true` when global `scope` is active AND the resource declares a function `scope`. */
  scopeRequired: boolean;
}

/** Bind `resource.options.scope` to `reqCtx.scope` for a single request. */
export function scopeBinding(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
): ScopeBinding {
  const resourceScope = resource.options.scope;
  const scopeRequired = !!config.scope && typeof resourceScope === "function";

  if (typeof resourceScope === "function") {
    const scopeValue = reqCtx.scope;
    const predicate = resourceScope as (scope: unknown, query: unknown) => unknown;
    return {
      boundScope: bindAdapterScope((query: unknown) => predicate(scopeValue, query)),
      applyScope: (query: unknown) => predicate(scopeValue, query),
      scopeRequired,
    };
  }

  return { scopeRequired };
}
