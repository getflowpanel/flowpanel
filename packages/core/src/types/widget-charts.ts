import type { NumericFormat, RangeLimit, RowKey, Span } from "./widget";
import type { Link, WidgetContext } from "./widget-context";

/** Aggregation bucket for the chart's x-axis. */
export type ChartBucket = "minute" | "hour" | "day" | "week" | "month" | "year" | "auto";

/** Charts are defined in @flowpanel/charts but their config lives in core. */
export interface ChartOptionsBase<R = unknown> {
  /** Row key plotted on the x-axis. */
  x: RowKey<R>;
  /** Row key(s) plotted on the y-axis. An array draws one series per key. */
  y: RowKey<R> | RowKey<R>[];
  /** Chart height in px.
   * @defaultValue 240
   */
  height?: number;
  /** How y-values are rendered in ticks and tooltips. */
  format?: NumericFormat;
  /** `false` omits the `<Tooltip>` entirely. */
  tooltip?: "default" | "compact" | false;
  /** Turns the whole card into a link — a path, a named target, or one computed from the context. */
  drilldown?: Link;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
  /** X-axis aggregation bucket. */
  bucket?: ChartBucket;
}

export interface AreaChartOptions<R = unknown> extends ChartOptionsBase<R> {
  /** Stack multiple series instead of overlaying them. */
  stacked?: boolean;
  /** Draw curved rather than straight segments. */
  smooth?: boolean;
}
export interface BarChartOptions<R = unknown> extends ChartOptionsBase<R> {
  /** Stack multiple series instead of grouping them side by side. */
  stacked?: boolean;
  /** Lay bars out horizontally. */
  horizontal?: boolean;
}
export interface LineChartOptions<R = unknown> extends ChartOptionsBase<R> {
  /** Draw curved rather than straight segments. */
  smooth?: boolean;
  /** Show a dot at every data point. */
  markers?: boolean;
}
export interface PieChartOptions<R = unknown> {
  /** Row key naming each slice. */
  category: RowKey<R>;
  /** Row key holding each slice's magnitude. */
  value: RowKey<R>;
  /** Cut a hole in the middle. */
  donut?: boolean;
  /** Show the slice legend.
   * @defaultValue true
   */
  showLegend?: boolean;
  /** Chart height in px. */
  height?: number;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Turns the whole card into a link — a path, a named target, or one computed from the context. */
  drilldown?: Link;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
  /** Pin specific slices to a color, keyed by category value. */
  colors?: Record<string, string>;
  /** How slice values are rendered in the tooltip. */
  format?: NumericFormat;
  /** `false` omits the `<Tooltip>` entirely. */
  tooltip?: "default" | "compact" | false;
}

export interface AreaChartWidget {
  kind: "areaChart";
  label: string;
  query: (ctx: WidgetContext) => Promise<unknown[]>;
  options: AreaChartOptions;
}
export interface BarChartWidget {
  kind: "barChart";
  label: string;
  query: (ctx: WidgetContext) => Promise<unknown[]>;
  options: BarChartOptions;
}
export interface LineChartWidget {
  kind: "lineChart";
  label: string;
  query: (ctx: WidgetContext) => Promise<unknown[]>;
  options: LineChartOptions;
}
export interface PieChartWidget {
  kind: "pieChart";
  label: string;
  query: (ctx: WidgetContext) => Promise<unknown[]>;
  options: PieChartOptions;
}
