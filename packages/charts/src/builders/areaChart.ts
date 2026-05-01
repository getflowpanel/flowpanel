import type { AreaChartOptions, AreaChartWidget, WidgetContext } from "@flowpanel/core";

export function areaChart(
  label: string,
  query: (ctx: WidgetContext) => Promise<unknown[]>,
  options: AreaChartOptions,
): AreaChartWidget {
  return { kind: "areaChart", label, query, options };
}
