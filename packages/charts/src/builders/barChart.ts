import type { BarChartOptions, BarChartWidget, WidgetContext } from "@flowpanel/core";

export function barChart<R = unknown>(
  label: string,
  query: (ctx: WidgetContext) => Promise<R[]>,
  options: BarChartOptions<R>,
): BarChartWidget {
  return { kind: "barChart", label, query, options: options as BarChartOptions };
}
