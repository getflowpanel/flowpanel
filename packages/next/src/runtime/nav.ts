import type {
  IconName,
  NavGroupRef,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { accessAllows, resolveOperationAccess, resolveResourceName } from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core/labels";
import type { NavEntry, NavGroup } from "@flowpanel/react";
import { AUDIT_LOG_SEGMENT, auditReadable } from "./audit-view";
import { buildHref, buildPath } from "./href";
import { pluralLabel } from "./resource-title";

/** Extract the URL slug for a resource. */
export const resourceNavName = resolveResourceName;

/** A resource is advertised only when the caller could actually open its list. */
export function readableByCaller(
  resource: ResourceConfig,
  reqCtx: RequestContext,
): Promise<boolean> {
  return accessAllows(resolveOperationAccess(resource.options.access, "read"), reqCtx);
}

function groupBuilder() {
  const groups: NavGroup[] = [];
  const byLabel = new Map<string, NavGroup>();
  const kindIcons = new Map<NavEntry, IconName>();
  const place = (
    fallback: string,
    ref: NavGroupRef | undefined,
    entry: NavEntry,
    kindIcon: IconName,
  ): void => {
    kindIcons.set(entry, kindIcon);
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
  /** In a group where some entries have an icon, an entry without one takes its kind's, so no row reads as a sub-item. */
  const settle = (): NavGroup[] => {
    for (const group of groups) {
      if (!group.items.some((item) => item.icon)) continue;
      group.items = group.items.map((item) => {
        const icon = item.icon ?? kindIcons.get(item);
        return icon ? { ...item, icon } : item;
      });
    }
    return groups;
  };
  return { groups, place, settle };
}

/**
 * Sidebar groups in the order their first entry arrives. An entry without
 * `navGroup` joins its kind's own group — Dashboards, Pages, Resources or Queues.
 */
export async function buildNav(
  config: ResolvedAdminConfig,
  reqCtx?: RequestContext,
): Promise<NavGroup[]> {
  const { navigation, audit } = mergeLabels(config.labels);
  const { groups, place, settle } = groupBuilder();

  for (const d of config.dashboardsByPath.values()) {
    if (reqCtx && !(await accessAllows(d.access, reqCtx))) continue;
    place(
      navigation.dashboards,
      d.navGroup,
      {
        label: d.label,
        href: d.path === "/" ? buildHref(config) : buildPath(config, d.path),
        ...(d.icon ? { icon: d.icon } : {}),
      },
      "layout-dashboard",
    );
  }

  for (const p of config.pagesByPath.values()) {
    if (reqCtx && !(await accessAllows(p.access, reqCtx))) continue;
    const own = p.path === "/" ? buildHref(config) : buildPath(config, p.path);
    place(
      navigation.pages,
      p.navGroup,
      {
        label: p.label,
        href: p.component !== undefined ? own : (p.href ?? buildPath(config, p.path)),
        ...(p.icon ? { icon: p.icon } : {}),
      },
      "file-text",
    );
  }

  for (const r of config.resourcesByName.values()) {
    if (r.options.hidden) continue;
    if (reqCtx && !(await readableByCaller(r, reqCtx))) continue;
    const name = resourceNavName(r);
    place(
      navigation.resources,
      r.options.navGroup,
      {
        label: pluralLabel(r, name),
        href: buildHref(config, name),
        ...(r.options.icon ? { icon: r.options.icon } : {}),
      },
      "list",
    );
  }

  for (const [key, q] of config.queuesByKey.entries()) {
    if (q.options.hidden || (reqCtx && !(await accessAllows(q.options.access, reqCtx)))) continue;
    place(
      navigation.queues,
      q.options.navGroup,
      {
        label: q.options.label,
        href: buildHref(config, "queues", key),
        ...(q.options.icon ? { icon: q.options.icon } : {}),
      },
      "inbox",
    );
  }

  if (config.auditLog && (!reqCtx || (await auditReadable(config, reqCtx)))) {
    groups.push({
      items: [{ label: audit.title, href: buildHref(config, AUDIT_LOG_SEGMENT), icon: "history" }],
    });
  }

  return settle();
}
