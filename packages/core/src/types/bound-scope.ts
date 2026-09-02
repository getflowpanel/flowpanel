/** Opaque request-bound tenant policy an adapter applies to every query it builds. */
export interface BoundAdapterScope {
  readonly kind: "flowpanel.bound-scope";
  apply(query: unknown): unknown;
}

export function bindAdapterScope(apply: (query: unknown) => unknown): BoundAdapterScope {
  return Object.freeze({ kind: "flowpanel.bound-scope", apply });
}
