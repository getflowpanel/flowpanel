import type { AreaChartOptions, AreaChartWidget, WidgetContext } from "@flowpanel/core";

export function areaChart<R = unknown>(
  label: string,
  query: (ctx: WidgetContext) => Promise<R[]>,
  options: AreaChartOptions<R>,
): AreaChartWidget {
  return { kind: "areaChart", label, query, options: options as AreaChartOptions };
}
