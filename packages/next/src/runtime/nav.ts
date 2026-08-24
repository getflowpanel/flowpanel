import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { humanize, resolveResourceName } from "@flowpanel/core";
import type { NavGroup } from "@flowpanel/react";
import { roleAllows } from "./action-helpers.js";
import { buildHref } from "./href.js";

/** Extract the URL slug for a resource. */
export const resourceNavName = resolveResourceName;

export function buildNav(config: ResolvedAdminConfig, reqCtx?: RequestContext): NavGroup[] {
  const groups: NavGroup[] = [];

  const dashboardItems = [...config.dashboardsByPath.values()]
    .filter((d) => !reqCtx || roleAllows(d.requireRole, reqCtx))
    .map((d) => ({
      label: d.label,
      href: d.path === "/" ? buildHref(config) : buildHref(config, d.path),
      ...(d.icon ? { icon: d.icon } : {}),
    }));
  if (dashboardItems.length) groups.push({ label: "Dashboards", items: dashboardItems });

  const pageItems = [...config.pagesByPath.values()]
    .filter((p) => !reqCtx || roleAllows(p.requireRole, reqCtx))
    .map((p) => ({
      label: p.label,
      href:
        p.component !== undefined
          ? p.path === "/"
            ? buildHref(config)
            : buildHref(config, p.path)
          : (p.href ?? buildHref(config, p.path)),
      ...(p.icon ? { icon: p.icon } : {}),
    }));
  if (pageItems.length) groups.push({ label: "Pages", items: pageItems });

  const resourceItems = [...config.resourcesByName.values()]
    .filter(
      (r: ResourceConfig) =>
        !r.options.hidden && (!reqCtx || roleAllows(r.options.requireRole, reqCtx)),
    )
    .map((r: ResourceConfig) => {
      const name = resourceNavName(r);
      return {
        label: r.options.plural ?? r.options.label ?? humanize(name),
        href: buildHref(config, name),
        ...(r.options.icon ? { icon: r.options.icon } : {}),
      };
    });
  if (resourceItems.length) groups.push({ label: "Resources", items: resourceItems });

  const queueItems = [...config.queuesByKey.entries()]
    .filter(([, q]) => !q.options.hidden && (!reqCtx || roleAllows(q.options.requireRole, reqCtx)))
    .map(([key, q]) => ({
      label: q.options.label,
      href: buildHref(config, "queues", key),
      ...(q.options.icon ? { icon: q.options.icon } : {}),
    }));
  if (queueItems.length) groups.push({ label: "Queues", items: queueItems });

  return groups;
}
