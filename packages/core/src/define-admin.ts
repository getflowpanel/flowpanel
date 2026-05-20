import type { BulkAction } from "./types/action.js";
import type { AdminConfig, ResolvedAdminConfig } from "./types/config.js";
import type { DashboardConfig } from "./types/dashboard.js";
import type { QueueConfig } from "./types/queue.js";
import type { ResourceConfig } from "./types/resource.js";

function resolveResourceName(ref: unknown, options: { name?: string }): string {
  if (options.name) return options.name;
  if (ref && typeof ref === "object") {
    const r = ref as { __name?: unknown; _?: { name?: unknown } };
    if (typeof r.__name === "string") return r.__name;
    if (r._ && typeof r._ === "object" && typeof r._.name === "string") return r._.name;
    // Drizzle: table name lives on Symbol(drizzle:Name).
    for (const sym of Object.getOwnPropertySymbols(ref)) {
      if (sym.description === "drizzle:Name") {
        const v = (ref as Record<symbol, unknown>)[sym];
        if (typeof v === "string") return v;
      }
    }
  }
  throw new Error(
    "Unable to resolve resource name. Pass options.name explicitly, " +
      "or ensure the adapter ref exposes __name or _.name.",
  );
}

/**
 * Sentinel BulkAction injected by `defineAdmin` when a resource has `delete`
 * enabled and no explicit `bulkActions`. The actual delete execution is wired
 * at the runtime layer (@flowpanel/next) in Phase 4; this `run` is a no-op
 * guard so the shape is a valid BulkAction.
 */
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

/**
 * Resolve a FlowPanel admin configuration.
 *
 * Pure: `config` and every nested `ResourceConfig` / `ResourceConfig.options`
 * is treated as immutable. For each resource where `delete` is enabled
 * (i.e. not `delete: { disabled: true }`) and `bulkActions` is `undefined`,
 * a CLONED resource with `bulkActions: [defaultDeleteBulk]` is produced.
 * Opt out with `bulkActions: []` or `delete: { disabled: true }`.
 */
export function defineAdmin(config: AdminConfig): ResolvedAdminConfig {
  const resources = (config.resources ?? []).map((r) => {
    const deleteDisabled = r.options.delete?.disabled === true;
    if (!deleteDisabled && r.options.bulkActions === undefined) {
      return { ...r, options: { ...r.options, bulkActions: [defaultDeleteBulk] } };
    }
    return r;
  });
  const resourcesByName = new Map<string, ResourceConfig>();
  for (const r of resources) {
    const name = resolveResourceName(r.ref, r.options);
    if (resourcesByName.has(name)) {
      throw new Error(`Duplicate resource name: "${name}". Each resource name must be unique.`);
    }
    resourcesByName.set(name, r);
  }
  const dashboardsByPath = new Map<string, DashboardConfig>();
  for (const d of config.dashboards ?? []) {
    if (dashboardsByPath.has(d.path)) {
      throw new Error(`Duplicate dashboard path: "${d.path}".`);
    }
    dashboardsByPath.set(d.path, d);
  }
  const queuesByKey = new Map<string, QueueConfig>();
  for (const q of config.queues ?? []) {
    const name = (q.ref as { name?: string })?.name;
    const key = q.options.key ?? name;
    if (!key) throw new Error("queue() requires options.key when the queue has no .name");
    if (queuesByKey.has(key)) throw new Error(`duplicate queue key: ${key}`);
    queuesByKey.set(key, q);
  }
  return {
    ...config,
    resources,
    __resolved: true,
    resourcesByName,
    dashboardsByPath,
    queuesByKey,
  };
}
