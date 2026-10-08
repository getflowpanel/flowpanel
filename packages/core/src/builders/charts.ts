import type {
  AreaChartOptions,
  AreaChartWidget,
  BarChartOptions,
  BarChartWidget,
  LineChartOptions,
  LineChartWidget,
  PieChartOptions,
  PieChartWidget,
} from "../types/widget-charts";
import type { WidgetContext } from "../types/widget-context";

export function areaChart<R = unknown>(
  label: string,
  query: (ctx: WidgetContext) => Promise<R[]>,
  options: AreaChartOptions<R>,
): AreaChartWidget {
  return { kind: "areaChart", label, query, options: options as AreaChartOptions };
}

export function barChart<R = unknown>(
  label: string,
  query: (ctx: WidgetContext) => Promise<R[]>,
  options: BarChartOptions<R>,
): BarChartWidget {
  return { kind: "barChart", label, query, options: options as BarChartOptions };
}

export function lineChart<R = unknown>(
  label: string,
  query: (ctx: WidgetContext) => Promise<R[]>,
  options: LineChartOptions<R>,
): LineChartWidget {
  return { kind: "lineChart", label, query, options: options as LineChartOptions };
}

export function pieChart<R = unknown>(
  label: string,
  query: (ctx: WidgetContext) => Promise<R[]>,
  options: PieChartOptions<R>,
): PieChartWidget {
  return { kind: "pieChart", label, query, options: options as PieChartOptions };
}
