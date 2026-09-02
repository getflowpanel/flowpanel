import { FlowpanelAccessError } from "./types/error";

/** The scope-carrying half of a query context, as an adapter sees it. */
export interface AdapterScopeContext {
  boundScope?: { apply(query: unknown): unknown } | undefined;
  /** @deprecated Superseded by `boundScope`. Removal target: 0.3. */
  applyScope?: ((query: unknown) => unknown) | undefined;
  scopeRequired?: boolean | undefined;
}

/**
 * The tenant predicate this request is bound to, or `null` when the resource
 * declares none. Throws when one is required but absent: an adapter must never
 * fall back to running the query unscoped.
 */
export function resolveScopeApplier(
  ctx: AdapterScopeContext,
): ((query: unknown) => unknown) | null {
  const applyScope = ctx.boundScope?.apply ?? ctx.applyScope;
  if (applyScope) return applyScope;
  if (ctx.scopeRequired) {
    throw new FlowpanelAccessError(
      "scope required but not bound: a scope predicate is declared and global scope " +
        "is active, but the adapter received no applyScope. Refusing to run an unscoped query.",
    );
  }
  return null;
}
