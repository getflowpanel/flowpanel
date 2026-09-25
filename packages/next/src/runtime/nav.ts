import type {
  NavGroupRef,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { accessAllows, resolveOperationAccess, resolveResourceName } from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core/labels";
import type { NavEntry, NavGroup } from "@flowpanel/react";
import { roleAllows } from "./action-helpers";
import { buildHref, buildPath } from "./href";
import { pluralLabel } from "./resource-title";

/** Extract the URL slug for a resource. */
export const resourceNavName = resolveResourceName;

/** A resource is advertised only when the caller could actually open its list. */
export function readableByCaller(
  resource: ResourceConfig,
  reqCtx: RequestContext,
): Promise<boolean> {
  return accessAllows(
    resolveOperationAccess(resource.options.access, resource.options.requireRole, "read"),
    reqCtx,
  );
}

function groupBuilder() {
  const groups: NavGroup[] = [];
  const byLabel = new Map<string, NavGroup>();
  const place = (fallback: string, ref: NavGroupRef | undefined, entry: NavEntry): void => {
    const label = ref === undefined ? fallback : typeof ref === "string" ? ref : ref.label;
    let group = byLabel.get(label);
    if (!group) {
      group = { label, items: [] };
      byLabel.set(label, group);
      groups.push(group);
    }
    if (typeof ref === "object" && ref.collapsed) group.collapsible = true;
    group.items.push(entry);
  };
  return { groups, place };
}

/**
 * Sidebar groups in the order their first entry arrives. An entry without
 * `navGroup` joins its kind's own group — Dashboards, Pages, Resources or Queues.
 */
export async function buildNav(
  config: ResolvedAdminConfig,
  reqCtx?: RequestContext,
): Promise<NavGroup[]> {
  const { navigation } = mergeLabels(config.labels);
  const { groups, place } = groupBuilder();

  for (const d of config.dashboardsByPath.values()) {
    if (reqCtx && !roleAllows(d.requireRole, reqCtx)) continue;
    place(navigation.dashboards, d.navGroup, {
      label: d.label,
      href: d.path === "/" ? buildHref(config) : buildPath(config, d.path),
      ...(d.icon ? { icon: d.icon } : {}),
    });
  }

  for (const p of config.pagesByPath.values()) {
    if (reqCtx && !roleAllows(p.requireRole, reqCtx)) continue;
    const own = p.path === "/" ? buildHref(config) : buildPath(config, p.path);
    place(navigation.pages, p.navGroup, {
      label: p.label,
      href: p.component !== undefined ? own : (p.href ?? buildPath(config, p.path)),
      ...(p.icon ? { icon: p.icon } : {}),
    });
  }

  for (const r of config.resourcesByName.values()) {
    if (r.options.hidden) continue;
    if (reqCtx && !(await readableByCaller(r, reqCtx))) continue;
    const name = resourceNavName(r);
    place(navigation.resources, r.options.navGroup, {
      label: pluralLabel(r, name),
      href: buildHref(config, name),
      ...(r.options.icon ? { icon: r.options.icon } : {}),
    });
  }

  for (const [key, q] of config.queuesByKey.entries()) {
    if (q.options.hidden || (reqCtx && !roleAllows(q.options.requireRole, reqCtx))) continue;
    place(navigation.queues, q.options.navGroup, {
      label: q.options.label,
      href: buildHref(config, "queues", key),
      ...(q.options.icon ? { icon: q.options.icon } : {}),
    });
  }

  return groups;
}
