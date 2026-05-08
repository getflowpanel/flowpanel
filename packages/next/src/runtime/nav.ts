import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import type { NavGroup } from "@flowpanel/react";

export function resourceNavName(resource: { ref: unknown; options: { name?: string } }): string {
  if (resource.options.name) return resource.options.name;
  const ref = resource.ref as { __name?: unknown; _?: { name?: unknown } } | null;
  if (ref && typeof ref === "object") {
    if (typeof ref.__name === "string") return ref.__name;
    if (ref._ && typeof ref._ === "object" && typeof ref._.name === "string") return ref._.name;
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
