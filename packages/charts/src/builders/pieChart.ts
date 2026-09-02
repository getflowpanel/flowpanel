import type { PieChartOptions, PieChartWidget, WidgetContext } from "@flowpanel/core";

export function pieChart<R = unknown>(
  label: string,
  query: (ctx: WidgetContext) => Promise<R[]>,
  options: PieChartOptions<R>,
): PieChartWidget {
  return { kind: "pieChart", label, query, options: options as PieChartOptions };
}
