import { resolveResourceName } from "./resource-name.js";
import type { BulkAction } from "./types/action.js";
import type { AdminConfig, ResolvedAdminConfig } from "./types/config.js";
import type { DashboardConfig, PageConfig } from "./types/dashboard.js";
import type { QueueConfig } from "./types/queue.js";
import type { ResourceConfig } from "./types/resource.js";

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
      columns: r.options.columns.map((c) =>
        typeof c === "object" && c.editable ? { ...c, editable: false } : c,
      ),
    },
  };
}

/** Resolve a FlowPanel admin configuration. */
export function defineAdmin(config: AdminConfig): ResolvedAdminConfig {
  const resources = (config.resources ?? []).map((r) => {
    if (config.readOnly) return readOnlyResource(r);
    const deleteDisabled = r.options.delete?.disabled === true;
    if (!deleteDisabled && r.options.bulkActions === undefined) {
      return { ...r, options: { ...r.options, bulkActions: [defaultDeleteBulk] } };
    }
    return r;
  });
  const resourcesByName = new Map<string, ResourceConfig>();
  for (const r of resources) {
    const name = resolveResourceName(r);
    if (resourcesByName.has(name)) {
      throw new Error(`Duplicate resource name: "${name}". Each resource name must be unique.`);
    }
    if (r.options.rowClick === "drawer" && r.options.drawer === undefined) {
      throw new Error(
        `resource "${name}" sets rowClick: "drawer" but has no drawer config. ` +
          `Add drawer: { fields: "*" } or change rowClick.`,
      );
    }
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
    if (queuesByKey.has(key)) throw new Error(`duplicate queue key: ${key}`);
    queuesByKey.set(key, q);
  }
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
