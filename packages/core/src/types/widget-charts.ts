import type { KeyLabels } from "../internal/key-labels";
import type { RealtimeOption } from "./realtime";
import type { NumericFormat, RangeLimit, RowKey, Span } from "./widget";
import type { CaptionOptions } from "./widget-caption";
import type { Link, WidgetContext } from "./widget-context";

/** How the x-axis prints a date key. */
export type ChartBucket = "minute" | "hour" | "day" | "week" | "month" | "year" | "auto";

/** Charts are defined in @flowpanel/charts but their config lives in core. */
export interface ChartOptionsBase<R = unknown> extends CaptionOptions {
  /** Row key plotted on the x-axis. */
  x: RowKey<R>;
  /**
   * Row key(s) plotted on the y-axis; an array draws one series per key. Default: every
   * key of the first row except `x`, in its order — the columns a `series({ by })` returns.
   */
  y?: RowKey<R> | RowKey<R>[];
  /** Legend and tooltip name per series key: a map, an `enumOf()` or a function. Default: the key. */
  labels?: KeyLabels;
  /**
   * A CSS colour per series key, e.g. `{ paid: "hsl(var(--fp-chart-1))" }`. Default: `--fp-data`
   * for a single series, `--fp-chart-1…7` in `y` order for several.
   */
  colors?: Readonly<Record<string, string>>;
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
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
  /** How x-axis ticks print a date key. It does not aggregate: fold rows with `series({ grain })`. */
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
export interface PieChartOptions<R = unknown> extends CaptionOptions {
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
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
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
