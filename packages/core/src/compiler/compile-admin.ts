import { reservedNameError } from "../reserved-names.js";
import { resolveResourceName } from "../resource-name.js";
import type { BulkAction } from "../types/action.js";
import type { Adapter, ResourceIntrospection } from "../types/adapter.js";
import type { CompiledAdmin, CompiledResource } from "../types/compiled.js";
import type { AdminConfig, ResolvedAdminConfig } from "../types/config.js";
import type { DashboardConfig, PageConfig } from "../types/dashboard.js";
import type { QueueConfig } from "../types/queue.js";
import type { AnyResourceConfig, ResourceConfig } from "../types/resource.js";
import { validateResourceColumns } from "../validate-resource-columns.js";
import { validateResourceRefs } from "../validate-resource-refs.js";
import { warnIfNoAccessControl } from "../warn-open-admin.js";
import { collectResourceExposure } from "./exposure.js";
import { normalizeRoutePath, RouteNameRegistry } from "./route-graph.js";

const defaultDeleteBulk: BulkAction<unknown> = {
  key: "delete",
  label: "Delete",
  variant: "destructive",
  confirm: { title: "Delete selected items?", description: "This cannot be undone." },
  run: async () => ({
    ok: false,
    error: "default bulk delete is wired at the runtime layer; this sentinel should never execute",
  }),
};

function readOnlyResource(resource: ResourceConfig): ResourceConfig {
  const { import: _import, ...options } = resource.options;
  return {
    ...resource,
    options: {
      ...options,
      create: { ...resource.options.create, disabled: true },
      update: { ...resource.options.update, disabled: true },
      delete: { ...resource.options.delete, disabled: true },
      actions: [],
      bulkActions: [],
      ...(resource.options.drawer ? { drawer: { ...resource.options.drawer, actions: [] } } : {}),
      ...(resource.options.columns
        ? {
            columns: resource.options.columns.map((column) =>
              typeof column === "object" &&
              column !== null &&
              "editable" in column &&
              column.editable
                ? { ...column, editable: false }
                : column,
            ),
          }
        : {}),
    },
  };
}

function tryIntrospect(adapter: Adapter, ref: unknown): ResourceIntrospection | null {
  try {
    return adapter.introspect(ref);
  } catch {
    return null;
  }
}
function assertUniqueActionKeys(
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
function assertCanonicalAccess(resource: ResourceConfig, resourceName: string): void {
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
function assertCanonicalFieldAccess(
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
function assertProductionAuth(config: AdminConfig): void {
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

function normalizeDeclaredRoutePath(raw: string): string {
  if (raw.trim() === "") {
    throw new Error('Declare the root route explicitly as "/" instead of an empty path.');
  }
  return normalizeRoutePath(raw);
}

export function compileAdmin<const Resources extends readonly AnyResourceConfig[]>(
  config: AdminConfig<Resources>,
): CompiledAdmin {
  assertProductionAuth(config);
  const resources: ResourceConfig[] = [];
  const resourcesByName = new Map<string, ResourceConfig>();
  const compiledResourcesByName = new Map<string, CompiledResource>();
  const routeNames = new RouteNameRegistry();

  for (const raw of config.resources ?? []) {
    const name = resolveResourceName(raw);
    if (resourcesByName.has(name)) {
      throw new Error(`Duplicate resource name: "${name}". Each resource name must be unique.`);
    }
    const reserved = reservedNameError("resource", name, "options.name");
    if (reserved) throw new Error(reserved);
    routeNames.add("resource", name);
    routeNames.addPath("resource", `/${name}`, name);

    if (raw.options.rowClick === "drawer" && raw.options.drawer === undefined) {
      throw new Error(
        `resource "${name}" sets rowClick: "drawer" but has no drawer config. ` +
          `Add drawer: { fields: "*" } or change rowClick.`,
      );
    }
    assertUniqueActionKeys(raw.options.actions, name, "options.actions");
    assertUniqueActionKeys(raw.options.bulkActions, name, "options.bulkActions");
    assertUniqueActionKeys(raw.options.drawer?.actions, name, "options.drawer.actions");
    assertCanonicalAccess(raw, name);

    let resource: ResourceConfig = raw;
    if (config.readOnly) {
      resource = readOnlyResource(raw);
    } else if (raw.options.delete?.disabled !== true && raw.options.bulkActions === undefined) {
      resource = { ...raw, options: { ...raw.options, bulkActions: [defaultDeleteBulk] } };
    }

    const introspection = tryIntrospect(config.adapter, resource.ref);
    const columns = introspection?.columns ?? null;
    if (resource.options.columns === undefined) {
      if (columns === null || columns.length === 0) {
        throw new Error(
          `resource "${name}" omits options.columns, but the adapter could not introspect its ` +
            "ref, so there is nothing to fill them from. Declare options.columns explicitly.",
        );
      }
      resource = {
        ...resource,
        options: { ...resource.options, columns: columns.map((column) => column.name) },
      };
    }
    if (columns !== null) validateResourceColumns(name, resource, columns);
    assertCanonicalFieldAccess(resource, name, introspection);

    resources.push(resource);
    resourcesByName.set(name, resource);
    compiledResourcesByName.set(name, {
      name,
      definition: resource,
      introspection,
      ...collectResourceExposure(resource, introspection),
    });
  }

  const dashboardsByPath = new Map<string, DashboardConfig>();
  for (const dashboard of config.dashboards ?? []) {
    const path = normalizeDeclaredRoutePath(dashboard.path);
    if (dashboardsByPath.has(path)) {
      throw new Error(`Duplicate dashboard path: "${dashboard.path}".`);
    }
    routeNames.addPath("dashboard", path, dashboard.path);
    dashboardsByPath.set(path, dashboard);
  }

  const pagesByPath = new Map<string, PageConfig>();
  for (const page of config.pages ?? []) {
    const path = normalizeDeclaredRoutePath(page.path);
    if (pagesByPath.has(path)) throw new Error(`Duplicate page path: "${page.path}".`);
    if (dashboardsByPath.has(path)) {
      throw new Error(`Page path "${page.path}" collides with a dashboard at the same path.`);
    }
    routeNames.addPath("page", path, page.path);
    pagesByPath.set(path, page);
  }

  const queuesByKey = new Map<string, QueueConfig>();
  for (const queue of config.queues ?? []) {
    const name = (queue.ref as { name?: string })?.name;
    const key = queue.options.key ?? name;
    if (!key) throw new Error("queue() requires options.key when the queue has no .name");
    if (queuesByKey.has(key)) {
      throw new Error(`Duplicate queue key: "${key}". Each queue key must be unique.`);
    }
    const reserved = reservedNameError("queue", key, "options.key");
    if (reserved) throw new Error(reserved);
    routeNames.add("queue", key);
    routeNames.addPath("queue", `/queues/${key}`, key);
    queuesByKey.set(key, queue);
  }

  validateResourceRefs(resourcesByName, config.dashboards ?? []);
  warnIfNoAccessControl(config, resources);

  const basePath = normalizeRoutePath(config.paths?.admin ?? config.basePath ?? "/admin");
  const paths = {
    admin: basePath,
    api: normalizeRoutePath(config.paths?.api ?? "/api/flowpanel"),
  };
  const resolved: ResolvedAdminConfig<Resources> = {
    ...config,
    resources: resources as unknown as Resources,
    __resolved: true,
    resourcesByName,
    dashboardsByPath,
    pagesByPath,
    queuesByKey,
    basePath,
    paths,
  };

  return {
    definition: config,
    resolved,
    resourcesByName: compiledResourcesByName,
  };
}
