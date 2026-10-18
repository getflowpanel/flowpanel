import { widgetSites } from "../../internal/widget-sites";
import type { DashboardConfig } from "../../types/dashboard";
import type { ResourceConfig } from "../../types/resource";

const CHART_KINDS: ReadonlySet<string> = new Set(["areaChart", "barChart", "lineChart"]);

/** A chart whose `minorUnits` divides its values while nothing prints them as money. */
export function chartFormatWarnings(
  dashboards: readonly DashboardConfig[],
  resourcesByName: ReadonlyMap<string, ResourceConfig>,
): string[] {
  const warnings: string[] = [];
  for (const { owner, site, widget } of widgetSites(dashboards, resourcesByName)) {
    if (!CHART_KINDS.has(widget.kind)) continue;
    const { minorUnits, format } = widget.options as { minorUnits?: unknown; format?: unknown };
    if (typeof minorUnits !== "number" || minorUnits <= 0 || format === "currency") continue;
    const shown = format === undefined ? "it has no format" : `its format is "${String(format)}"`;
    warnings.push(
      `${owner} ${site} minorUnits: it divides every value by ${10 ** minorUnits}, but ${shown}, ` +
        `so the axis and tooltips show plain numbers. Add format: "currency", or drop minorUnits.`,
    );
  }
  return warnings;
}
