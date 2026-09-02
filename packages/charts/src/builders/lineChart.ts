import type { LineChartOptions, LineChartWidget, WidgetContext } from "@flowpanel/core";

export function lineChart<R = unknown>(
  label: string,
  query: (ctx: WidgetContext) => Promise<R[]>,
  options: LineChartOptions<R>,
): LineChartWidget {
  return { kind: "lineChart", label, query, options: options as LineChartOptions };
}
