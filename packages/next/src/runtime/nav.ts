import type { ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { humanize, resolveResourceName } from "@flowpanel/core";
import type { NavGroup } from "@flowpanel/react";
import { buildHref } from "./href.js";

/** Extract the URL slug for a resource. */
export const resourceNavName = resolveResourceName;

export function buildNav(config: ResolvedAdminConfig): NavGroup[] {
  const groups: NavGroup[] = [];

  const dashboardItems = [...config.dashboardsByPath.values()].map((d) => ({
    label: d.label,
    href: d.path === "/" ? buildHref(config) : buildHref(config, d.path),
  }));
  if (dashboardItems.length) groups.push({ label: "Dashboards", items: dashboardItems });

  const pageItems = [...config.pagesByPath.values()].map((p) => ({
    label: p.label,
    href:
      p.component !== undefined
        ? p.path === "/"
          ? buildHref(config)
          : buildHref(config, p.path)
        : (p.href ?? buildHref(config, p.path)),
  }));
  if (pageItems.length) groups.push({ label: "Pages", items: pageItems });

  const resourceItems = [...config.resourcesByName.values()]
    .filter((r: ResourceConfig) => !r.options.hidden)
    .map((r: ResourceConfig) => {
      const name = resourceNavName(r);
      return {
        label: r.options.plural ?? r.options.label ?? humanize(name),
        href: buildHref(config, name),
      };
    });
  if (resourceItems.length) groups.push({ label: "Resources", items: resourceItems });

  const queueItems = [...config.queuesByKey.entries()].map(([key, q]) => ({
    label: q.options.label,
    href: buildHref(config, "queues", key),
  }));
  if (queueItems.length) groups.push({ label: "Queues", items: queueItems });

  return groups;
}
