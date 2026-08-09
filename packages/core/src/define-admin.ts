import { reservedNameError } from "./reserved-names.js";
import { resolveResourceName } from "./resource-name.js";
import type { BulkAction } from "./types/action.js";
import type { Adapter, ColumnMeta } from "./types/adapter.js";
import type { AdminConfig, ResolvedAdminConfig } from "./types/config.js";
import type { DashboardConfig, PageConfig } from "./types/dashboard.js";
import type { QueueConfig } from "./types/queue.js";
import type { ResourceConfig } from "./types/resource.js";
import { validateResourceColumns } from "./validate-resource-columns.js";
import { validateResourceRefs } from "./validate-resource-refs.js";
import { warnIfNoAccessControl } from "./warn-open-admin.js";

function normalizeRoutePath(raw: string): string {
  let p = raw.trim();
  if (p === "" || p === "/") return "/";
  if (!p.startsWith("/")) p = `/${p}`;
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

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

function readOnlyResource(r: ResourceConfig): ResourceConfig {
  const { import: _import, ...options } = r.options;
  return {
    ...r,
    options: {
      ...options,
      create: { ...r.options.create, disabled: true },
      update: { ...r.options.update, disabled: true },
      delete: { ...r.options.delete, disabled: true },
      actions: [],
      bulkActions: [],
      ...(r.options.drawer ? { drawer: { ...r.options.drawer, actions: [] } } : {}),
      ...(r.options.columns
        ? {
            columns: r.options.columns.map((c) =>
              typeof c === "object" && c.editable ? { ...c, editable: false } : c,
            ),
          }
        : {}),
    },
  };
}

/** `null` when the adapter cannot resolve this ref — introspection is best-effort here. */
function tryIntrospect(adapter: Adapter, ref: unknown): ColumnMeta[] | null {
  try {
    return adapter.introspect(ref).columns;
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
  for (const a of actions) {
    if (seen.has(a.key)) {
      throw new Error(
        `Duplicate action key: "${a.key}" in resource "${resourceName}" ${where}. ` +
          "Each action key must be unique within its list.",
      );
    }
    seen.add(a.key);
  }
}

/** Resolve a FlowPanel admin configuration. */
export function defineAdmin(config: AdminConfig): ResolvedAdminConfig {
  const resources: ResourceConfig[] = [];
  const resourcesByName = new Map<string, ResourceConfig>();
  for (const raw of config.resources ?? []) {
    const name = resolveResourceName(raw);
    if (resourcesByName.has(name)) {
      throw new Error(`Duplicate resource name: "${name}". Each resource name must be unique.`);
    }
    const reserved = reservedNameError("resource", name, "options.name");
    if (reserved) throw new Error(reserved);
    if (raw.options.rowClick === "drawer" && raw.options.drawer === undefined) {
      throw new Error(
        `resource "${name}" sets rowClick: "drawer" but has no drawer config. ` +
          `Add drawer: { fields: "*" } or change rowClick.`,
      );
    }
    assertUniqueActionKeys(raw.options.actions, name, "options.actions");
    assertUniqueActionKeys(raw.options.bulkActions, name, "options.bulkActions");
    assertUniqueActionKeys(raw.options.drawer?.actions, name, "options.drawer.actions");

    let r = raw;
    if (config.readOnly) {
      r = readOnlyResource(raw);
    } else if (raw.options.delete?.disabled !== true && raw.options.bulkActions === undefined) {
      r = { ...raw, options: { ...raw.options, bulkActions: [defaultDeleteBulk] } };
    }

    const introspected = tryIntrospect(config.adapter, r.ref);
    if (r.options.columns === undefined) {
      if (introspected === null || introspected.length === 0) {
        throw new Error(
          `resource "${name}" omits options.columns, but the adapter could not introspect its ` +
            "ref, so there is nothing to fill them from. Declare options.columns explicitly.",
        );
      }
      r = { ...r, options: { ...r.options, columns: introspected.map((c) => c.name) } };
    }
    if (introspected !== null) validateResourceColumns(name, r, introspected);

    resources.push(r);
    resourcesByName.set(name, r);
  }
  const dashboardsByPath = new Map<string, DashboardConfig>();
  for (const d of config.dashboards ?? []) {
    const path = normalizeRoutePath(d.path);
    if (dashboardsByPath.has(path)) {
      throw new Error(`Duplicate dashboard path: "${d.path}".`);
    }
    dashboardsByPath.set(path, d);
  }
  const pagesByPath = new Map<string, PageConfig>();
  for (const p of config.pages ?? []) {
    const path = normalizeRoutePath(p.path);
    if (pagesByPath.has(path)) {
      throw new Error(`Duplicate page path: "${p.path}".`);
    }
    if (dashboardsByPath.has(path)) {
      throw new Error(`Page path "${p.path}" collides with a dashboard at the same path.`);
    }
    pagesByPath.set(path, p);
  }
  const queuesByKey = new Map<string, QueueConfig>();
  for (const q of config.queues ?? []) {
    const name = (q.ref as { name?: string })?.name;
    const key = q.options.key ?? name;
    if (!key) throw new Error("queue() requires options.key when the queue has no .name");
    if (queuesByKey.has(key)) {
      throw new Error(`Duplicate queue key: "${key}". Each queue key must be unique.`);
    }
    const reserved = reservedNameError("queue", key, "options.key");
    if (reserved) throw new Error(reserved);
    queuesByKey.set(key, q);
  }
  validateResourceRefs(resourcesByName, config.dashboards ?? []);
  warnIfNoAccessControl(config, resources);

  const rawBasePath = config.basePath ?? "/admin";
  let basePath = rawBasePath.trim();
  if (basePath !== "" && !basePath.startsWith("/")) basePath = `/${basePath}`;
  if (basePath.endsWith("/")) basePath = basePath.slice(0, -1);

  return {
    ...config,
    resources,
    __resolved: true,
    resourcesByName,
    dashboardsByPath,
    pagesByPath,
    queuesByKey,
    basePath,
  };
}
