import { devAuthInProduction, isDevAuth } from "../../auth/dev";
import { didYouMean } from "../../suggest";
import type { ResourceIntrospection } from "../../types/adapter";
import type { AdminDefinition } from "../../types/config";
import { FlowpanelConfigError } from "../../types/config-error";
import type { ResourceConfig } from "../../types/resource";
import { accessAdmitsSignedOut } from "./auth-probe";

export function assertUniqueActionKeys(
  actions: ReadonlyArray<{ key: string }> | undefined,
  resourceName: string,
  where: string,
): void {
  if (!actions) return;
  const seen = new Set<string>();
  for (const action of actions) {
    if (seen.has(action.key)) {
      throw new FlowpanelConfigError(
        `resource "${resourceName}" ${where}`,
        `the action key "${action.key}" appears twice. Give each action in the list its own key.`,
      );
    }
    seen.add(action.key);
  }
}
/** An action form is serialized at render, so it cannot carry a reference picker or function options. */
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
      throw new FlowpanelConfigError(
        `resource "${resourceName}" ${where} "${action.key}" form field "${String(field.name)}"`,
        `it declares ${unsupported}, but an action form is serialized when the page renders and ` +
          "accepts only a literal options array. Move the lookup into the action's run, or make " +
          "it a resource form field.",
      );
    }
  }
}

export function assertBulkActionLimits(resource: ResourceConfig, resourceName: string): void {
  for (const action of resource.options.bulkActions ?? []) {
    if (action.max === undefined) continue;
    if (!Number.isInteger(action.max) || action.max < 1 || action.max > 10_000) {
      throw new FlowpanelConfigError(
        `resource "${resourceName}" bulkActions "${action.key}" max`,
        `it is ${String(action.max)}. Set a whole number from 1 to 10000.`,
      );
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
      throw new FlowpanelConfigError(
        `resource "${resourceName}" fieldAccess.${field}`,
        `the resource has no column "${field}".${didYouMean(field, [...known])} Name a column of the table.`,
      );
    }
    if (policy.sensitive === true && policy.read !== undefined && policy.read !== false) {
      throw new FlowpanelConfigError(
        `resource "${resourceName}" fieldAccess.${field}`,
        "a sensitive field cannot also declare read access. Remove read, or drop sensitive.",
      );
    }
  }
}
export function assertProductionAuth(config: AdminDefinition): void {
  if (process.env.NODE_ENV !== "production") return;
  if (isDevAuth(config.auth)) throw devAuthInProduction();
  const admitsSignedOut = accessAdmitsSignedOut(config.auth);
  if (config.auth.access !== undefined && !admitsSignedOut) return;
  if (config.auth.allowUnauthenticated !== true) {
    throw new FlowpanelConfigError(
      "auth.access",
      admitsSignedOut
        ? "it lets a signed-out visitor in: it allowed { session: null }. A rule function " +
            "receives { session, role, scope }, so write ({ session }) => session !== null. For a " +
            "deliberately public admin, set auth.allowUnauthenticated: true and readOnly: true."
        : "a production admin requires it. Set auth.access, or for a deliberately public admin " +
            "set auth.allowUnauthenticated: true and readOnly: true.",
    );
  }
  if (config.readOnly !== true) {
    throw new FlowpanelConfigError(
      "readOnly",
      "a production admin with auth.allowUnauthenticated must also set readOnly: true. A " +
        "writable admin needs a real auth provider and auth.access.",
    );
  }
}

const warnedInProduction = new Set<string>();

const TRUSTED_PROXIES_FIX =
  "Set security.trustedProxies to the number of proxies in front of the app that append to " +
  "X-Forwarded-For: 1 on Vercel, behind one nginx or Traefik, or with Cloudflare straight to the " +
  'app; 2 for Cloudflare in front of nginx. With no proxy, use per: "user" for signed-in ' +
  "operators, or set rateLimit.enabled: false.";

/** A rate limit keyed by an IP FlowPanel cannot know; `per: "ip"` is refused in production, the rest warn. */
export function rateLimitKeyWarning(config: AdminDefinition): string | null {
  const limit = config.rateLimit;
  if (!limit || limit.enabled === false || (config.security?.trustedProxies ?? 0) >= 1) return null;
  const problem =
    limit.per === "ip"
      ? {
          where: "rateLimit.per",
          what: 'it is "ip", but ctx.ip is null until security.trustedProxies is set, so the limit cannot tell callers apart.',
        }
      : config.auth.allowUnauthenticated === true
        ? {
            where: "rateLimit",
            what: "signed-out visitors have no user id, and ctx.ip is null until security.trustedProxies is set, so they are not limited.",
          }
        : null;
  if (!problem) return null;
  const message = `${problem.what} ${TRUSTED_PROXIES_FIX}`;
  const production = process.env.NODE_ENV === "production";
  if (production && limit.per === "ip") throw new FlowpanelConfigError(problem.where, message);
  const warning = `${problem.where}: ${message}`;
  if (production && !warnedInProduction.has(warning)) {
    warnedInProduction.add(warning);
    console.warn(`[flowpanel] ${warning}`);
  }
  return warning;
}

export function assertTrustedProxies(config: AdminDefinition): void {
  const hops = config.security?.trustedProxies;
  if (hops === undefined || (Number.isInteger(hops) && hops >= 0)) return;
  throw new FlowpanelConfigError(
    "security.trustedProxies",
    `it is ${String(hops)}, not a whole number of proxies. Count the proxies that append to ` +
      "X-Forwarded-For, or leave it out.",
  );
}

/** A `dashboards` entry that is a dashboard, or the error that says where a page or a section-less entry goes. */
export function asDashboard(
  entry: NonNullable<AdminDefinition["dashboards"]>[number],
  index: number,
) {
  if (entry.kind !== "page" && "sections" in entry && Array.isArray(entry.sections)) return entry;
  throw new FlowpanelConfigError(
    `dashboards[${index}]`,
    entry.kind === "page"
      ? "it is a page(). Register pages under pages: [...], next to dashboards."
      : "it has no sections. Give it sections: [...], or register a custom page with page() under pages.",
  );
}

/** Under an admin-wide `scope`, every resource narrows its own rows or says it shares them. */
export function assertOwnScope(name: string, resource: ResourceConfig, globalScope: boolean): void {
  const own = resource.options.scope;
  if (!globalScope || own === "bypass" || typeof own === "function") return;
  throw new FlowpanelConfigError(
    `resource "${name}" scope`,
    "the admin has a global scope, so every resource needs its own. Add scope: (scope, query) => … " +
      'to the resource, or scope: "bypass" for a table every tenant shares.',
  );
}
