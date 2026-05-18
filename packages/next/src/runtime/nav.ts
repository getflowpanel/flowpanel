import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import type { NavGroup } from "@flowpanel/react";

/**
 * Extract the URL slug for a resource. Resolution order:
 *   1. `options.name` (explicit user override)
 *   2. `ref.__name` (test fixture / generic shape)
 *   3. `ref._.name` (older Drizzle / common adapters)
 *   4. Drizzle 0.30+ stores the table name under `Symbol(drizzle:BaseName)`
 *   5. fallback: "resource" (last resort — should not happen in practice)
 */
export function resourceNavName(resource: { ref: unknown; options: { name?: string } }): string {
  if (resource.options.name) return resource.options.name;
  const ref = resource.ref as { __name?: unknown; _?: { name?: unknown } } | null | undefined;
  if (ref && typeof ref === "object") {
    if (typeof ref.__name === "string") return ref.__name;
    if (ref._ && typeof ref._ === "object" && typeof ref._.name === "string") return ref._.name;
    for (const sym of Object.getOwnPropertySymbols(ref)) {
      if (sym.toString() === "Symbol(drizzle:BaseName)") {
        const value = (ref as Record<symbol, unknown>)[sym];
        if (typeof value === "string") return value;
      }
    }
  }
  return "resource";
}

export function buildNav(config: ResolvedAdminConfig): NavGroup[] {
  const groups: NavGroup[] = [];
  const resourceItems = [...config.resourcesByName.values()]
    .filter((r: ResourceConfig) => !r.options.hidden)
    .map((r: ResourceConfig) => {
      const name = resourceNavName(r);
      return {
        label: r.options.plural ?? r.options.label ?? name,
        href: `/admin/${name}`,
      };
    });
  if (resourceItems.length) groups.push({ label: "Resources", items: resourceItems });

  const queueItems = [...config.queuesByKey.entries()].map(([key, q]) => ({
    label: q.options.label,
    href: `/admin/queues/${key}`,
  }));
  if (queueItems.length) groups.push({ label: "Queues", items: queueItems });

  return groups;
}
