import { writeTarget } from "../internal/write-target";
import { RU_LABELS } from "../locales/ru";
import { assertNotReservedName } from "../reserved-names";
import { resolveResourceName } from "../resource-name";
import type { ResourceIntrospection } from "../types/adapter";
import type { CompiledAdmin, CompiledResource } from "../types/compiled";
import type { AdminDefinition, ResolvedAdminConfig } from "../types/config";
import { FlowpanelConfigError } from "../types/config-error";
import type { DashboardConfig, PageConfig } from "../types/dashboard";
import { DEFAULT_LABELS, type LabelsConfig, mergeLabels } from "../types/labels";
import type { QueueConfig } from "../types/queue";
import type { AnyResourceConfig, ResourceConfig } from "../types/resource";
import { resolveAuditLog } from "./audit-log";
import { withBuiltinBulkDelete } from "./builtin-bulk-delete";
import { resolveDetailWidgets } from "./detail-widgets";
import { withEnumOptions } from "./enum-options";
import { tryIntrospect } from "./introspect";
import { resolveRelatedTabs } from "./related-tabs";
import { normalizeRoutePath, RouteNameRegistry } from "./route-graph";
import { withDashboardTimelineIds } from "./timeline-ids";
import {
  asDashboard,
  assertBulkActionLimits,
  assertCanonicalFieldAccess,
  assertOwnScope,
  assertProductionAuth,
  assertServableActionForm,
  assertTrustedProxies,
  assertUniqueActionKeys,
  rateLimitKeyWarning,
} from "./validate/config";
import { validateDashboardFilters } from "./validate/dashboard-filters";
import { validateDeclaredKinds } from "./validate/declared-kinds";
import { type LinkCheck, validateLinks } from "./validate/links";
import { assertMoneyFields } from "./validate/money-fields";
import { validateRealtime } from "./validate/realtime";
import { validateRecordSources } from "./validate/record-sources";
import { assertNoRemovedConfigKeys, assertNoRemovedResourceKeys } from "./validate/removed-keys";
import { validateResourceColumns } from "./validate/resource-columns";
import { validateReferenceLabels, validateResourceRefs } from "./validate/resource-refs";
import { validateThresholds } from "./validate/thresholds";
import { createFieldWarnings, warnCreateFieldsOnce } from "./validate/warn-create-fields";
import { warnIfNoAccessControl } from "./validate/warn-open-admin";
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

/** Every runtime path reads one row key: the declared `rowKey`, else the introspected primary key, else `"id"`. */
function withRowKey(
  resource: ResourceConfig,
  introspection: ResourceIntrospection | null,
): ResourceConfig {
  if (resource.options.rowKey !== undefined) return resource;
  const rowKey = introspection?.primaryKey || "id";
  return { ...resource, options: { ...resource.options, rowKey } };
}

function normalizeDeclaredRoutePath(raw: string, where: string): string {
  if (raw.trim() === "") {
    throw new FlowpanelConfigError(where, 'the path is empty. Declare the root route as "/".');
  }
  return normalizeRoutePath(raw, where);
}

/** A Russian locale takes `RU_LABELS` as its base, unless the host passes a whole language, `DEFAULT_LABELS` included. */
function localeLabels(
  locale: string | undefined,
  labels: LabelsConfig | undefined,
): LabelsConfig | undefined {
  if (!locale || !/^ru(?:-|$)/i.test(locale)) return labels;
  const whole = labels !== undefined && Object.keys(DEFAULT_LABELS).every((key) => key in labels);
  return whole ? labels : mergeLabels(labels, RU_LABELS);
}

export function compileAdmin<const Resources extends readonly AnyResourceConfig[]>(
  config: AdminDefinition<Resources>,
): CompiledAdmin {
  assertNoRemovedConfigKeys(config as unknown as Record<string, unknown>);
  assertProductionAuth(config);
  assertTrustedProxies(config);
  const rateLimitWarning = rateLimitKeyWarning(config);
  const resources: ResourceConfig[] = [];
  const resourcesByName = new Map<string, ResourceConfig>();
  const compiledResourcesByName = new Map<string, CompiledResource>();
  const routeNames = new RouteNameRegistry();
  const warnings: string[] = rateLimitWarning ? [rateLimitWarning] : [];
  const auditLog = resolveAuditLog(config.audit, config.adapter);
  if (auditLog) routeNames.addPath("page", "/audit-log", "the built-in Audit log");

  for (const raw of config.resources ?? []) {
    const name = resolveResourceName(raw);
    if (resourcesByName.has(name)) {
      throw new FlowpanelConfigError(
        `resource "${name}"`,
        "two resources have this name. Set name on one of them so each is unique.",
      );
    }
    assertNotReservedName("resource", name, "name");
    routeNames.add("resource", name);
    routeNames.addPath("resource", `/${name}`, name);

    if (raw.options.rowClick === "drawer" && raw.options.drawer === undefined) {
      throw new FlowpanelConfigError(
        `resource "${name}" rowClick`,
        `it is "drawer" but the resource has no drawer. Add drawer: { fields: "*" }, or change rowClick.`,
      );
    }
    assertNoRemovedResourceKeys(name, raw.options as Record<string, unknown>);
    assertUniqueActionKeys(raw.options.actions, name, "actions");
    assertUniqueActionKeys(raw.options.bulkActions, name, "bulkActions");
    assertUniqueActionKeys(raw.options.drawer?.actions, name, "drawer.actions");
    assertServableActionForm(raw.options.actions, name, "actions");
    assertServableActionForm(raw.options.bulkActions, name, "bulkActions");
    assertBulkActionLimits(raw, name);
    assertMoneyFields(raw, name);
    validateDeclaredKinds(name, raw);
    assertOwnScope(name, raw, config.scope !== undefined);
    const probe = tryIntrospect(config.adapter, raw.ref);
    const introspection = probe.introspection;
    const viewed = viewResource(name, raw, introspection, config.adapter);

    let resource = config.readOnly ? readOnlyResource(viewed) : withBuiltinBulkDelete(viewed);

    const columns = introspection?.columns ?? null;
    if (resource.options.columns === undefined) {
      if (columns === null || columns.length === 0) {
        throw new FlowpanelConfigError(
          `resource "${name}" columns`,
          "they are omitted, and the adapter could not introspect the table to fill them in. " +
            "Declare columns.",
          probe.error === undefined ? undefined : { cause: probe.error },
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
        : tryIntrospect(config.adapter, writeTarget(resource)).introspection;
    if (written) warnings.push(...createFieldWarnings(name, resource, written));
    assertCanonicalFieldAccess(resource, name, introspection);

    resource = withEnumOptions(withRowKey(resource, introspection));
    resources.push(resource);
    resourcesByName.set(name, resource);
    compiledResourcesByName.set(name, {
      name,
      definition: resource,
      introspection,
    });
  }

  const dashboards = (config.dashboards ?? []).map((entry, index) =>
    withDashboardTimelineIds(asDashboard(entry, index)),
  );
  const dashboardsByPath = new Map<string, DashboardConfig>();
  for (const [index, dashboard] of dashboards.entries()) {
    const path = normalizeDeclaredRoutePath(dashboard.path, `dashboards[${index}].path`);
    if (dashboardsByPath.has(path)) {
      throw new FlowpanelConfigError(
        `dashboard "${dashboard.path}"`,
        "two dashboards use this path. Give each dashboard its own path.",
      );
    }
    routeNames.addPath("dashboard", path, dashboard.path);
    dashboardsByPath.set(path, dashboard);
  }

  const pagesByPath = new Map<string, PageConfig>();
  for (const [index, page] of (config.pages ?? []).entries()) {
    const path = normalizeDeclaredRoutePath(page.path, `pages[${index}].path`);
    if (pagesByPath.has(path)) {
      throw new FlowpanelConfigError(
        `page "${page.path}"`,
        "two pages use this path. Give each page its own path.",
      );
    }
    if (dashboardsByPath.has(path)) {
      throw new FlowpanelConfigError(
        `page "${page.path}"`,
        "a dashboard already uses this path. Move the page or the dashboard to another path.",
      );
    }
    routeNames.addPath("page", path, page.path);
    pagesByPath.set(path, page);
  }

  const queuesByKey = new Map<string, QueueConfig>();
  for (const [index, queue] of (config.queues ?? []).entries()) {
    const name = queue.ref?.name;
    const key = queue.options.key ?? name;
    if (!key) {
      throw new FlowpanelConfigError(
        `queues[${index}]`,
        "the queue has no name to key it by. Set key in its options.",
      );
    }
    if (queuesByKey.has(key)) {
      throw new FlowpanelConfigError(
        `queue "${key}"`,
        "two queues use this key. Give each queue its own key.",
      );
    }
    assertNotReservedName("queue", key, "key");
    routeNames.add("queue", key);
    routeNames.addPath("queue", `/queues/${key}`, key);
    queuesByKey.set(key, queue);
  }

  for (const [name, current] of resourcesByName) {
    const resolved = resolveDetailWidgets(name, resolveRelatedTabs(name, current, resourcesByName));
    if (resolved === current) continue;
    resources[resources.indexOf(current)] = resolved;
    resourcesByName.set(name, resolved);
    const compiled = compiledResourcesByName.get(name);
    if (compiled) compiledResourcesByName.set(name, { ...compiled, definition: resolved });
  }
  validateResourceRefs(resourcesByName, dashboards);
  validateRealtime(resourcesByName, dashboards, config.realtime);
  validateDashboardFilters(dashboards, resourcesByName);
  validateThresholds(dashboards, resourcesByName);
  const linkCheck: LinkCheck = {
    resourcesByName,
    columnsOf: (name) =>
      compiledResourcesByName.get(name)?.introspection?.columns.map((column) => column.name) ?? [],
    paths: new Set([...dashboardsByPath.keys(), ...pagesByPath.keys()]),
    dashboardFilters: new Map(
      dashboards.map((d) => [
        normalizeRoutePath(d.path, `dashboard "${d.path}"`),
        (d.filters ?? []).map((filter) => filter.key),
      ]),
    ),
  };
  validateLinks(linkCheck, dashboards);
  validateReferenceLabels(linkCheck);
  validateRecordSources(linkCheck, dashboards);
  warnIfNoAccessControl(config, resources);
  warnCreateFieldsOnce(warnings);

  const paths = {
    admin: normalizeRoutePath(config.paths?.admin ?? "/admin", "paths.admin"),
    api: normalizeRoutePath(config.paths?.api ?? "/api/flowpanel", "paths.api"),
  };
  const labels = localeLabels(config.formatting?.locale, config.labels);
  const { dashboards: _declared, ...definition } = config;
  const resolved: ResolvedAdminConfig<Resources> = {
    ...definition,
    ...(labels ? { labels } : {}),
    ...(config.dashboards ? { dashboards } : {}),
    resources: resources as unknown as Resources,
    __resolved: true,
    resourcesByName,
    dashboardsByPath,
    pagesByPath,
    queuesByKey,
    paths,
    auditLog,
    warnings,
  };

  return {
    definition: config,
    resolved,
    resourcesByName: compiledResourcesByName,
  };
}
