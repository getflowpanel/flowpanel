import { quoted } from "./internal/validate-shared";
import { widgetSites } from "./internal/widget-sites";
import { didYouMean } from "./suggest";
import type { DashboardConfig } from "./types/dashboard";
import type { ResourceConfig } from "./types/resource";

function filterOf(widget: unknown): string | undefined {
  const options = (widget as { options?: { filterOnClick?: unknown } } | null)?.options;
  return typeof options?.filterOnClick === "string" ? options.filterOnClick : undefined;
}

/**
 * Throws when a widget's `filterOnClick` names a filter its dashboard does not declare, a
 * dashboard declares one twice, or a record-page or drawer widget sets one.
 */
export function validateDashboardFilters(
  dashboards: readonly DashboardConfig[],
  resourcesByName: ReadonlyMap<string, ResourceConfig>,
): void {
  const declared = new Map<string, string[]>();
  for (const d of dashboards) {
    const keys = (d.filters ?? []).map((filter) => filter.key);
    const twice = keys.find((key, index) => keys.indexOf(key) !== index);
    if (twice !== undefined) {
      throw new Error(`flowpanel: dashboard "${d.path}" declares the filter "${twice}" twice.`);
    }
    declared.set(`dashboard "${d.path}"`, keys);
  }
  for (const { owner, site, place, widget } of widgetSites(dashboards, resourcesByName)) {
    const key = filterOf(widget);
    if (key === undefined) continue;
    if (place !== "dashboard") {
      throw new Error(
        `flowpanel: ${owner} ${site} sets filterOnClick "${key}", but only a dashboard widget ` +
          "can set a dashboard filter.",
      );
    }
    const keys = declared.get(owner) ?? [];
    if (keys.includes(key)) continue;
    throw new Error(
      `flowpanel: ${owner} ${site} sets filterOnClick "${key}", which the dashboard does not ` +
        `declare.${didYouMean(key, keys)} Declared: ${quoted(keys)}.`,
    );
  }
}
