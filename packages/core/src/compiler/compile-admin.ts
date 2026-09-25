import { writeTarget } from "../internal/write-target";
import { RU_LABELS } from "../locales/ru";
import { reservedNameError } from "../reserved-names";
import { resolveResourceName } from "../resource-name";
import type { Adapter, ResourceIntrospection } from "../types/adapter";
import type { CompiledAdmin, CompiledResource } from "../types/compiled";
import type { AdminConfig, ResolvedAdminConfig } from "../types/config";
import type { DashboardConfig, PageConfig } from "../types/dashboard";
import { type LabelsConfig, mergeLabels } from "../types/labels";
import type { QueueConfig } from "../types/queue";
import type { AnyResourceConfig, ResourceConfig } from "../types/resource";
import { validateLinks } from "../validate-links";
import { validateResourceColumns } from "../validate-resource-columns";
import { validateResourceRefs } from "../validate-resource-refs";
import { createFieldWarnings, warnCreateFieldsOnce } from "../warn-create-fields";
import { warnIfNoAccessControl } from "../warn-open-admin";
import { createBuiltinBulkDelete } from "./builtin-bulk-delete";
import { resolveRelatedTabs } from "./related-tabs";
import { normalizeRoutePath, RouteNameRegistry } from "./route-graph";
import {
  assertCanonicalAccess,
  assertCanonicalFieldAccess,
  assertProductionAuth,
  assertServableActionForm,
  assertUniqueActionKeys,
} from "./validate-config";
import { viewResource } from "./view-resource";

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

/** A Russian `formatting.locale` makes `RU_LABELS` the base the host's labels merge over. */
function localeLabels(
  locale: string | undefined,
  labels: LabelsConfig | undefined,
): LabelsConfig | undefined {
  return locale && /^ru(?:-|$)/i.test(locale) ? mergeLabels(labels, RU_LABELS) : labels;
}

export function compileAdmin<const Resources extends readonly AnyResourceConfig[]>(
  config: AdminConfig<Resources>,
): CompiledAdmin {
  assertProductionAuth(config);
  const resources: ResourceConfig[] = [];
  const resourcesByName = new Map<string, ResourceConfig>();
  const compiledResourcesByName = new Map<string, CompiledResource>();
  const routeNames = new RouteNameRegistry();
  const warnings: string[] = [];

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
    const introspection = tryIntrospect(config.adapter, raw.ref);
    const viewed = viewResource(name, raw, introspection, config.adapter);

    let resource: ResourceConfig = viewed;
    if (config.readOnly) {
      resource = readOnlyResource(viewed);
    } else if (
      viewed.options.delete?.disabled !== true &&
      viewed.options.bulkActions === undefined
    ) {
      resource = {
        ...viewed,
        options: {
          ...viewed.options,
          bulkActions: [createBuiltinBulkDelete(viewed.options.delete?.confirm)],
        },
      };
    }

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
    const written =
      resource.options.writeTo === undefined
        ? introspection
        : tryIntrospect(config.adapter, writeTarget(resource));
    if (written) warnings.push(...createFieldWarnings(name, resource, written));
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

  for (const [name, current] of resourcesByName) {
    const resolved = resolveRelatedTabs(name, current, resourcesByName);
    if (resolved === current) continue;
    resources[resources.indexOf(current)] = resolved;
    resourcesByName.set(name, resolved);
    const compiled = compiledResourcesByName.get(name);
    if (compiled) compiledResourcesByName.set(name, { ...compiled, definition: resolved });
  }
  validateResourceRefs(resourcesByName, config.dashboards ?? []);
  validateLinks(
    {
      resourcesByName,
      columnsOf: (name) =>
        compiledResourcesByName.get(name)?.introspection?.columns.map((column) => column.name) ??
        [],
      paths: new Set([...dashboardsByPath.keys(), ...pagesByPath.keys()]),
    },
    config.dashboards ?? [],
  );
  warnIfNoAccessControl(config, resources);
  warnCreateFieldsOnce(warnings);

  const basePath = normalizeRoutePath(config.paths?.admin ?? config.basePath ?? "/admin");
  const paths = {
    admin: basePath,
    api: normalizeRoutePath(config.paths?.api ?? "/api/flowpanel"),
  };
  const labels = localeLabels(config.formatting?.locale, config.labels);
  const resolved: ResolvedAdminConfig<Resources> = {
    ...config,
    ...(labels ? { labels } : {}),
    resources: resources as unknown as Resources,
    __resolved: true,
    resourcesByName,
    dashboardsByPath,
    pagesByPath,
    queuesByKey,
    basePath,
    paths,
    warnings,
  };

  return {
    definition: config,
    resolved,
    resourcesByName: compiledResourcesByName,
  };
}
