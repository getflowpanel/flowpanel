import type { PieChartOptions, PieChartWidget, WidgetContext } from "@flowpanel/core";

export function pieChart(
  label: string,
  query: (ctx: WidgetContext) => Promise<unknown[]>,
  options: PieChartOptions,
): PieChartWidget {
  return { kind: "pieChart", label, query, options };
}
