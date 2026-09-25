import { didYouMean } from "./suggest";
import type { DashboardConfig } from "./types/dashboard";
import type { ResourceConfig } from "./types/resource";

function filterOf(widget: unknown): string | undefined {
  const options = (widget as { options?: { filter?: unknown } } | null)?.options;
  return typeof options?.filter === "string" ? options.filter : undefined;
}

function widgetsAt(list: unknown, where: string): Array<[string, unknown]> {
  return Array.isArray(list)
    ? list.map((widget, j): [string, unknown] => [`${where}[${j}]`, widget])
    : [];
}

function tabWidgets(tabs: unknown, where: string): Array<[string, unknown]> {
  if (!Array.isArray(tabs)) return [];
  return tabs.flatMap((tab, i) =>
    widgetsAt((tab as { widgets?: unknown } | null)?.widgets, `${where}[${i}].widgets`),
  );
}

/**
 * Throws when a widget sets a dashboard filter its dashboard does not declare, a dashboard
 * declares one twice, or a record-page or drawer widget sets one.
 */
export function validateDashboardFilters(
  dashboards: readonly DashboardConfig[],
  resourcesByName: ReadonlyMap<string, ResourceConfig>,
): void {
  for (const d of dashboards) {
    const keys = (d.filters ?? []).map((filter) => filter.key);
    const twice = keys.find((key, index) => keys.indexOf(key) !== index);
    if (twice !== undefined) {
      throw new Error(`dashboard "${d.path}" declares the filter "${twice}" twice.`);
    }
    d.sections.forEach((section, i) => {
      section.widgets.forEach((widget, j) => {
        const key = filterOf(widget);
        if (key === undefined || keys.includes(key)) return;
        throw new Error(
          `dashboard "${d.path}" sections[${i}].widgets[${j}] sets the filter "${key}", which the ` +
            `dashboard does not declare.${didYouMean(key, keys)} ` +
            `Declared: ${keys.length > 0 ? keys.map((k) => `"${k}"`).join(", ") : "(none)"}.`,
        );
      });
    });
  }
  for (const [name, r] of resourcesByName) {
    const o = r.options as {
      detail?: { tabs?: unknown; stats?: unknown; aside?: unknown };
      drawer?: { tabs?: unknown };
    };
    const sites = [
      ...tabWidgets(o.detail?.tabs, "detail.tabs"),
      ...widgetsAt(o.detail?.stats, "detail.stats"),
      ...widgetsAt(o.detail?.aside, "detail.aside"),
      ...tabWidgets(o.drawer?.tabs, "drawer.tabs"),
    ];
    for (const [where, widget] of sites) {
      const key = filterOf(widget);
      if (key === undefined) continue;
      throw new Error(
        `resource "${name}" ${where} sets the filter "${key}", but only a dashboard widget can set ` +
          "a dashboard filter.",
      );
    }
  }
}
