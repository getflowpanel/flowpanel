import type { BarChartOptions, BarChartWidget, WidgetContext } from "@flowpanel/core";

export function barChart(
  label: string,
  query: (ctx: WidgetContext) => Promise<unknown[]>,
  options: BarChartOptions,
): BarChartWidget {
  return { kind: "barChart", label, query, options };
}
