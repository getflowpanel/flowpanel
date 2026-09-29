/** The scope-carrying half of a query context, as an adapter sees it. */
export interface AdapterScopeContext {
  boundScope?: { apply(query: unknown): unknown } | undefined;
}

/** The tenant predicate this request is bound to, or `null` when the resource declares none. */
export function resolveScopeApplier(
  ctx: AdapterScopeContext,
): ((query: unknown) => unknown) | null {
  return ctx.boundScope?.apply ?? null;
}
