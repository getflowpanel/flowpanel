const ALL_TENANTS = Symbol.for("flowpanel.allTenants");

/** Return it from `scope` for staff who work across tenants: resource predicates are skipped for them. */
export const allTenants: Readonly<Record<string, never>> = /* @__PURE__ */ Object.freeze(
  /* @__PURE__ */ Object.defineProperty({}, ALL_TENANTS, { value: true, enumerable: false }),
);

/** Whether `scope` is `allTenants` itself; a copy made by spreading it is not. */
export function isAllTenants(scope: unknown): boolean {
  return typeof scope === "object" && scope !== null && Object.hasOwn(scope, ALL_TENANTS);
}
