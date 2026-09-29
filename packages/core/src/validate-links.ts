import { normalizeRoutePath } from "./compiler/route-graph";
import { filterShapeProblem } from "./internal/filter-shape";
import { declaredListFields } from "./internal/list-fields";
import { checkColumn, missing } from "./internal/validate-shared";
import type { DashboardConfig } from "./types/dashboard";
import type { MetricCountSource } from "./types/metric-count";
import type { ResourceConfig } from "./types/resource";
import type { TableWidgetOptions, WidgetConfig } from "./types/widget";

/** What the boot-time link checks read from a compiled admin. */
export interface LinkCheck {
  resourcesByName: ReadonlyMap<string, ResourceConfig>;
  /** A resource's introspected column names; empty when the adapter reports none. */
  columnsOf: (resource: string) => readonly string[];
  /** Every dashboard and page path, normalised. */
  paths: ReadonlySet<string>;
  /** Every dashboard's declared filter keys, by normalised path. */
  dashboardFilters: ReadonlyMap<string, readonly string[]>;
}

interface StaticLink {
  resource?: unknown;
  dashboard?: unknown;
  view?: unknown;
  tab?: unknown;
  filter?: unknown;
  range?: unknown;
}

function checkListField(site: string, resource: string, field: string, check: LinkCheck): void {
  if (!checkColumn(site, resource, field, check)) return;
  const target = check.resourcesByName.get(resource);
  if (!target || declaredListFields(target.options).has(field)) return;
  throw new Error(
    `flowpanel: ${site} filters "${resource}" by "${field}", which its list does not declare, so ` +
      `the list would drop it and show every row. Add "${field}" to that resource's filters or columns.`,
  );
}

function checkListValue(
  site: string,
  resource: string,
  field: string,
  value: unknown,
  check: LinkCheck,
): void {
  checkListField(site, resource, field, check);
  const target = check.resourcesByName.get(resource);
  if (!target || check.columnsOf(resource).length === 0) return;
  const problem = filterShapeProblem(target, field, value);
  if (!problem) return;
  throw new Error(
    `flowpanel: ${site} filters "${resource}" by "${field}" = ${JSON.stringify(value)}, but ` +
      `${problem}, so the list would show other rows than it names.`,
  );
}

function checkRangeFilter(site: string, resource: string, field: string, check: LinkCheck): void {
  const filters = (check.resourcesByName.get(resource)?.options.filters ?? []) as unknown[];
  const ranges = filters.flatMap((filter) => {
    const def = filter as { field?: unknown; type?: unknown };
    return def.type === "daterange" && typeof def.field === "string" ? [def.field] : [];
  });
  if (!ranges.includes(field)) missing(site, "daterange filter", field, ranges, resource);
}

function checkTarget(site: string, target: unknown, check: LinkCheck): void {
  if (typeof target !== "object" || target === null) return;
  const link = target as StaticLink;
  if (typeof link.dashboard === "string") {
    if (!check.paths.has(normalizeRoutePath(link.dashboard))) {
      missing(site, "dashboard", link.dashboard, [...check.paths]);
    }
    if (typeof link.filter === "object" && link.filter !== null) {
      const declared = check.dashboardFilters.get(normalizeRoutePath(link.dashboard)) ?? [];
      for (const key of Object.keys(link.filter)) {
        if (!declared.includes(key)) {
          missing(`${site}.filter`, "dashboard filter", key, declared, link.dashboard);
        }
      }
    }
    return;
  }
  if (typeof link.resource !== "string") return;
  const name = link.resource;
  const resource = check.resourcesByName.get(name);
  if (!resource) missing(site, "resource", name, [...check.resourcesByName.keys()]);
  if (typeof link.view === "string") {
    const views = (resource.options.views ?? []).map((view) => view.name);
    if (!views.includes(link.view)) missing(site, "view", link.view, views, name);
  }
  if (typeof link.tab === "string") {
    const tabs = (resource.options.detail?.tabs ?? []).map((tab) => tab.key);
    if (!tabs.includes(link.tab)) missing(site, "tab", link.tab, tabs, name);
  }
  if (typeof link.filter === "object" && link.filter !== null) {
    for (const [field, value] of Object.entries(link.filter)) {
      checkListValue(`${site}.filter`, name, field, value, check);
    }
  }
  if (typeof link.range === "string") checkRangeFilter(`${site}.range`, name, link.range, check);
}

function checkCountSource(site: string, source: MetricCountSource, check: LinkCheck): void {
  if (!check.resourcesByName.has(source.resource)) {
    missing(`${site}.count`, "resource", source.resource, [...check.resourcesByName.keys()]);
  }
  if (typeof source.where === "object") {
    for (const [field, value] of Object.entries(source.where)) {
      if (source.linked) checkListValue(`${site}.where`, source.resource, field, value, check);
      else checkColumn(`${site}.where`, source.resource, field, check);
    }
  }
  if (source.range === undefined) return;
  if (source.linked) checkRangeFilter(`${site}.range`, source.resource, source.range, check);
  else checkColumn(`${site}.range`, source.resource, source.range, check);
}

function checkTableScope(site: string, options: TableWidgetOptions, check: LinkCheck): void {
  if (options.where === undefined && options.range === undefined) return;
  if (typeof options.resource !== "string") {
    throw new Error(
      `flowpanel: ${site}.options sets where or range, which narrow a resource read; ` +
        "a query table filters its own rows.",
    );
  }
  if (typeof options.where === "object") {
    for (const field of Object.keys(options.where)) {
      checkColumn(`${site}.options.where`, options.resource, field, check);
    }
  }
  if (options.range !== undefined) {
    checkColumn(`${site}.options.range`, options.resource, options.range, check);
  }
}

function checkWidgets(site: string, widgets: readonly WidgetConfig[], check: LinkCheck): void {
  widgets.forEach((widget, index) => {
    const at = `${site}[${index}]`;
    const options = widget.options as {
      drilldown?: unknown;
      href?: unknown;
      seeAll?: unknown;
      more?: unknown;
      items?: unknown;
    };
    checkTarget(`${at}.options.drilldown`, options.drilldown, check);
    checkTarget(`${at}.options.href`, options.href, check);
    checkTarget(`${at}.options.seeAll`, options.seeAll, check);
    checkTarget(`${at}.options.more`, options.more, check);
    if (Array.isArray(options.items)) {
      options.items.forEach((item, i) => {
        const href = (item as { href?: unknown } | null)?.href;
        checkTarget(`${at}.options.items[${i}].href`, href, check);
      });
    }
    if (widget.kind === "metric" && widget.source) checkCountSource(at, widget.source, check);
    if (widget.kind === "table") checkTableScope(at, widget.options, check);
  });
}

function checkResource(name: string, resource: ResourceConfig, check: LinkCheck): void {
  (resource.options.views ?? []).forEach((view, i) => {
    const site = `resource "${name}" views[${i}]`;
    for (const [field, value] of Object.entries(view.filters ?? {})) {
      checkListValue(`${site}.filters`, name, field, value, check);
    }
    if (view.sort) checkColumn(`${site}.sort.field`, name, view.sort.field, check);
  });
  checkWidgets(`resource "${name}" detail.stats`, resource.options.detail?.stats ?? [], check);
  checkWidgets(`resource "${name}" detail.aside`, resource.options.detail?.aside ?? [], check);
  (resource.options.detail?.tabs ?? []).forEach((tab, i) => {
    const site = `resource "${name}" detail.tabs[${i}]`;
    checkWidgets(`${site}.widgets`, tab.widgets ?? [], check);
    if (typeof tab.resource !== "string") return;
    if (tab.by !== undefined) checkColumn(`${site}.by`, tab.resource, tab.by, check);
    for (const field of tab.hide ?? []) checkColumn(`${site}.hide`, tab.resource, field, check);
    if (tab.sort) checkColumn(`${site}.sort.field`, tab.resource, tab.sort.field, check);
  });
  (resource.options.drawer?.tabs ?? []).forEach((tab, i) => {
    if ("widgets" in tab)
      checkWidgets(`resource "${name}" drawer.tabs[${i}].widgets`, tab.widgets, check);
  });
}

/**
 * Throws at `defineAdmin` when a static link, a count metric, a saved view or a related tab names
 * a resource, dashboard, view, tab, column or filter that does not exist, with the closest name,
 * or filters by a value the target list would read as other rows.
 * A resource whose adapter reports no columns is not column-checked; function links are checked
 * when they render.
 */
export function validateLinks(check: LinkCheck, dashboards: readonly DashboardConfig[]): void {
  for (const board of dashboards) {
    (board.sections ?? []).forEach((section, s) => {
      checkWidgets(`dashboard "${board.path}" sections[${s}].widgets`, section.widgets, check);
    });
  }
  for (const [name, resource] of check.resourcesByName) checkResource(name, resource, check);
}
