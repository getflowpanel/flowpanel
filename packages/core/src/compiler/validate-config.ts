import type { ResourceIntrospection } from "../types/adapter";
import type { AdminConfig } from "../types/config";
import type { ResourceConfig } from "../types/resource";

export function assertUniqueActionKeys(
  actions: ReadonlyArray<{ key: string }> | undefined,
  resourceName: string,
  where: string,
): void {
  if (!actions) return;
  const seen = new Set<string>();
  for (const action of actions) {
    if (seen.has(action.key)) {
      throw new Error(
        `Duplicate action key: "${action.key}" in resource "${resourceName}" ${where}. ` +
          "Each action key must be unique within its list.",
      );
    }
    seen.add(action.key);
  }
}
/**
 * An action dialog is rendered from a wire-serialized field list built while the page
 * renders, so it can only carry values already resolved by then. A reference picker
 * needs a search endpoint, and a function's options need an await — neither exists on
 * this path, and both would silently render an unusable control.
 */
export function assertServableActionForm(
  actions: ReadonlyArray<{ key: string; form?: unknown }> | undefined,
  resourceName: string,
  where: string,
): void {
  for (const action of actions ?? []) {
    if (!Array.isArray(action.form)) continue;
    for (const field of action.form as Array<Record<string, unknown>>) {
      const unsupported =
        field.reference !== undefined || field.type === "reference"
          ? "a reference"
          : typeof field.options === "function"
            ? "options resolved by a function"
            : null;
      if (!unsupported) continue;
      throw new Error(
        `Action "${action.key}" in resource "${resourceName}" ${where} declares ${unsupported} ` +
          `on form field "${String(field.name)}". Action forms are serialized when the page ` +
          "renders, so they accept only a literal `options` array. Move the lookup into the " +
          "action's `run`, or expose it as a resource form field.",
      );
    }
  }
}

export function assertCanonicalAccess(resource: ResourceConfig, resourceName: string): void {
  if (resource.options.access !== undefined && resource.options.requireRole !== undefined) {
    throw new Error(
      `resource "${resourceName}" cannot declare both access and requireRole. ` +
        "Move the compatibility role rule into access.",
    );
  }
  const actionLists = [
    ...(resource.options.actions ?? []),
    ...(resource.options.bulkActions ?? []),
    ...(resource.options.drawer?.actions ?? []),
  ];
  for (const action of actionLists) {
    if ("access" in action && action.access !== undefined && action.requireRole !== undefined) {
      throw new Error(
        `action "${action.key}" on resource "${resourceName}" cannot declare both access and requireRole.`,
      );
    }
    if ("max" in action && action.max !== undefined) {
      if (!Number.isInteger(action.max) || action.max < 1 || action.max > 10_000) {
        throw new Error(
          `bulk action "${action.key}" on resource "${resourceName}" requires max between 1 and 10000.`,
        );
      }
    }
  }
}
export function assertCanonicalFieldAccess(
  resource: ResourceConfig,
  resourceName: string,
  introspection: ResourceIntrospection | null,
): void {
  const policies = resource.options.fieldAccess as
    | Record<string, { read?: unknown; write?: unknown; sensitive?: boolean }>
    | undefined;
  if (!policies) return;

  const known = new Set(introspection?.columns.map((column) => column.name) ?? []);
  if (known.size === 0) {
    for (const column of resource.options.columns ?? []) {
      if (typeof column === "string" || typeof column === "number" || typeof column === "symbol") {
        known.add(String(column));
      } else if (column.field) {
        known.add(column.field);
      }
    }
  }

  for (const [field, policy] of Object.entries(policies)) {
    if (known.size > 0 && !known.has(field)) {
      throw new Error(
        `fieldAccess declares unknown field "${field}" on resource "${resourceName}".`,
      );
    }
    if (policy.sensitive === true && policy.read !== undefined && policy.read !== false) {
      throw new Error(
        `sensitive field "${field}" on resource "${resourceName}" cannot declare readable access.`,
      );
    }
  }

  for (const field of [
    ...(resource.options.create?.fields ?? []),
    ...(resource.options.update?.fields ?? []),
  ]) {
    if (policies[field.name]?.write !== undefined && field.requireRole !== undefined) {
      throw new Error(
        `field "${field.name}" on resource "${resourceName}" cannot declare both fieldAccess.write and requireRole.`,
      );
    }
  }
}
export function assertProductionAuth(config: AdminConfig): void {
  if (process.env.NODE_ENV !== "production" || config.auth.requireRole !== undefined) return;
  if (config.auth.allowUnauthenticated !== true) {
    throw new Error(
      "A production admin requires auth.requireRole. For a deliberately public admin, set " +
        "auth.allowUnauthenticated: true and readOnly: true.",
    );
  }
  if (config.readOnly !== true) {
    throw new Error(
      "A production admin with auth.allowUnauthenticated must also set readOnly: true. " +
        "Writable deployments require a real authentication adapter and auth.requireRole.",
    );
  }
}
