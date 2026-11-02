import { quoted } from "../../internal/validate-shared";
import { widgetSites } from "../../internal/widget-sites";
import { didYouMean } from "../../suggest";
import { FlowpanelConfigError } from "../../types/config-error";
import type { DashboardConfig } from "../../types/dashboard";
import type { ResourceConfig } from "../../types/resource";

function filterOf(widget: unknown): string | undefined {
  const options = (widget as { options?: { filterOnClick?: unknown } } | null)?.options;
  return typeof options?.filterOnClick === "string" ? options.filterOnClick : undefined;
}

/** Throws on an undeclared or twice-declared dashboard filter, or a `filterOnClick` outside a dashboard. */
export function validateDashboardFilters(
  dashboards: readonly DashboardConfig[],
  resourcesByName: ReadonlyMap<string, ResourceConfig>,
): void {
  const declared = new Map<string, string[]>();
  for (const d of dashboards) {
    const keys = (d.filters ?? []).map((filter) => filter.key);
    const twice = keys.find((key, index) => keys.indexOf(key) !== index);
    if (twice !== undefined) {
      throw new FlowpanelConfigError(
        `dashboard "${d.path}" filters`,
        `the filter "${twice}" is declared twice. Give each filter its own key.`,
      );
    }
    declared.set(`dashboard "${d.path}"`, keys);
  }
  for (const { owner, site, place, widget } of widgetSites(dashboards, resourcesByName)) {
    const key = filterOf(widget);
    if (key === undefined) continue;
    if (place !== "dashboard") {
      throw new FlowpanelConfigError(
        `${owner} ${site}`,
        `it sets filterOnClick "${key}", but only a dashboard widget can set a dashboard ` +
          "filter. Remove filterOnClick.",
      );
    }
    const keys = declared.get(owner) ?? [];
    if (keys.includes(key)) continue;
    throw new FlowpanelConfigError(
      `${owner} ${site}`,
      `it sets filterOnClick "${key}", which the dashboard does not declare.` +
        `${didYouMean(key, keys)} Declared: ${quoted(keys)}.`,
    );
  }
}
