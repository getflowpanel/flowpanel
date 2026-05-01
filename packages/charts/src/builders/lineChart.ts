import type { LineChartOptions, LineChartWidget, WidgetContext } from "@flowpanel/core";

export function lineChart(
  label: string,
  query: (ctx: WidgetContext) => Promise<unknown[]>,
  options: LineChartOptions,
): LineChartWidget {
  return { kind: "lineChart", label, query, options };
}
