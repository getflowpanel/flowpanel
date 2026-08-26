import { reservedNameError } from "../reserved-names";
import { resolveResourceName } from "../resource-name";
import type { Adapter, ResourceIntrospection } from "../types/adapter";
import type { CompiledAdmin, CompiledResource } from "../types/compiled";
import type { AdminConfig, ResolvedAdminConfig } from "../types/config";
import type { DashboardConfig, PageConfig } from "../types/dashboard";
import type { QueueConfig } from "../types/queue";
import type { AnyResourceConfig, ResourceConfig } from "../types/resource";
import { validateResourceColumns } from "../validate-resource-columns";
import { validateResourceRefs } from "../validate-resource-refs";
import { warnIfNoAccessControl } from "../warn-open-admin";
import { builtinBulkDelete } from "./builtin-bulk-delete";
import { normalizeRoutePath, RouteNameRegistry } from "./route-graph";
import {
  assertCanonicalAccess,
  assertCanonicalFieldAccess,
  assertProductionAuth,
  assertServableActionForm,
  assertUniqueActionKeys,
} from "./validate-config";

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
    assertServableActionForm(raw.options.actions, name, "options.actions");
    assertServableActionForm(raw.options.bulkActions, name, "options.bulkActions");
    assertCanonicalAccess(raw, name);

    let resource: ResourceConfig = raw;
    if (config.readOnly) {
      resource = readOnlyResource(raw);
    } else if (raw.options.delete?.disabled !== true && raw.options.bulkActions === undefined) {
      resource = { ...raw, options: { ...raw.options, bulkActions: [builtinBulkDelete] } };
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
