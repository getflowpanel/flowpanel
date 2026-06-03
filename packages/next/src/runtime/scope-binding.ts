import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";

/**
 * Result of binding a resource's tenant-scope predicate to a request.
 *
 * Spread into every query / mutation context handed to an adapter:
 *
 * ```ts
 * const ctx: ListQueryContext<unknown> = {
 *   ...reqCtx,
 *   db: config.adapter.db,
 *   …,
 *   ...scopeBinding(config, resource, reqCtx),
 * };
 * ```
 */
export interface ScopeBinding {
  /**
   * Pre-bound scope predicate: the request's `scope` value is already
   * captured. The adapter calls it with its own query representation
   * (drizzle query builder / prisma `where` object). Absent when the
   * resource opts out (`scope: "bypass"`) or declares no scope.
   */
  applyScope?: (query: unknown) => unknown;
  /**
   * `true` when global `scope` is active AND the resource declares a function
   * `scope`. Adapters fail-closed: a `scopeRequired` context with no
   * `applyScope` must throw rather than run an unscoped query.
   */
  scopeRequired: boolean;
}

/**
 * Bind `resource.options.scope` to `reqCtx.scope` for a single request.
 *
 * - `scopeRequired` is `true` iff a global `config.scope` is active and the
 *   resource declares a *function* scope. (A `"bypass"` opt-out and an absent
 *   scope are both non-required — `assertResourceScope` already rejects the
 *   "global active + no scope + no bypass" case before we get here.)
 * - `applyScope` is produced only for a function scope; for `"bypass"` /
 *   undefined it is left absent so the adapter runs unscoped.
 *
 * The predicate captures `reqCtx.scope` so the adapter never has to know the
 * tenant value — it just threads its query through the closure.
 */
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
      applyScope: (query: unknown) => predicate(scopeValue, query),
      scopeRequired,
    };
  }

  // "bypass" or undefined → no predicate. `scopeRequired` is false here.
  return { scopeRequired };
}
