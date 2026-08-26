import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import { accessAllows, resolveOperationAccess, resolveResourceName } from "@flowpanel/core";
import type { NavEntry, NavGroup } from "@flowpanel/react";
import { roleAllows } from "./action-helpers";
import { buildHref } from "./href";
import { pluralLabel } from "./resource-title";

/** Extract the URL slug for a resource. */
export const resourceNavName = resolveResourceName;

/** A resource is advertised only when the caller could actually open its list. */
function readableByCaller(resource: ResourceConfig, reqCtx: RequestContext): Promise<boolean> {
  return accessAllows(
    resolveOperationAccess(resource.options.access, resource.options.requireRole, "read"),
    reqCtx,
  );
}

export async function buildNav(
  config: ResolvedAdminConfig,
  reqCtx?: RequestContext,
): Promise<NavGroup[]> {
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

  const resourceItems: NavEntry[] = [];
  for (const r of config.resourcesByName.values()) {
    if (r.options.hidden) continue;
    if (reqCtx && !(await readableByCaller(r, reqCtx))) continue;
    const name = resourceNavName(r);
    resourceItems.push({
      label: pluralLabel(r, name),
      href: buildHref(config, name),
      ...(r.options.icon ? { icon: r.options.icon } : {}),
    });
  }
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
