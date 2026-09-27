import type { DashboardConfig } from "../types/dashboard";
import type { ResourceConfig } from "../types/resource";
import type { WidgetConfig } from "../types/widget";

/** Where a widget sits: its owner, its config path, and the page it renders on. */
export interface WidgetSite {
  /** `dashboard "/path"` or `resource "name"`. */
  owner: string;
  /** The config path under the owner, e.g. `sections[0].widgets[2]`. */
  site: string;
  /** `dashboard`, `record` or `drawer`: the widgets of one owner and place render together. */
  place: "dashboard" | "record" | "drawer";
  /** The resource whose record page or drawer it sits on; absent on a dashboard. */
  resource?: string;
  /** The detail or drawer tab the widget sits in; absent elsewhere. */
  tab?: string;
  widget: WidgetConfig;
}

function* listed(
  list: unknown,
  base: Omit<WidgetSite, "site" | "widget">,
  where: string,
): Generator<WidgetSite> {
  if (!Array.isArray(list)) return;
  for (const [index, widget] of list.entries()) {
    if (typeof widget !== "object" || widget === null || !("kind" in widget)) continue;
    yield { ...base, site: `${where}[${index}]`, widget: widget as WidgetConfig };
  }
}

function* tabbed(
  tabs: unknown,
  base: Omit<WidgetSite, "site" | "widget">,
  where: string,
): Generator<WidgetSite> {
  if (!Array.isArray(tabs)) return;
  for (const [index, tab] of tabs.entries()) {
    const { key, widgets } = (tab ?? {}) as { key?: unknown; widgets?: unknown };
    const inTab = typeof key === "string" ? { ...base, tab: key } : base;
    yield* listed(widgets, inTab, `${where}[${index}].widgets`);
  }
}

/** Every widget a dashboard, a record page or a drawer declares, in config order. */
export function* widgetSites(
  dashboards: readonly DashboardConfig[],
  resourcesByName: ReadonlyMap<string, ResourceConfig>,
): Generator<WidgetSite> {
  for (const board of dashboards) {
    const base = { owner: `dashboard "${board.path}"`, place: "dashboard" as const };
    for (const [index, section] of (board.sections ?? []).entries()) {
      yield* listed(section.widgets, base, `sections[${index}].widgets`);
    }
  }
  for (const [name, resource] of resourcesByName) {
    const owner = `resource "${name}"`;
    const record = { owner, place: "record" as const, resource: name };
    const detail = resource.options.detail;
    yield* listed(detail?.stats, record, "detail.stats");
    yield* listed(detail?.aside, record, "detail.aside");
    yield* tabbed(detail?.tabs, record, "detail.tabs");
    const drawer = { owner, place: "drawer" as const, resource: name };
    yield* tabbed(resource.options.drawer?.tabs, drawer, "drawer.tabs");
  }
}
