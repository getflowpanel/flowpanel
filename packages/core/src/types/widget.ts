import type { ComponentType, ReactNode } from "react";
import type { ResolvedDateRange } from "./dashboard";
import type { ResolvedLabels } from "./labels";
import type { InferDB, ResourceName } from "./registry";
import type { ColumnFormat } from "./resource";
import type { Session } from "./session";
import type {
  BarsWidget,
  FunnelWidget,
  KvWidget,
  ListWidget,
  StatGroupWidget,
  StatWidget,
} from "./widget-cards";

/** Server-side context passed to every widget `query` function. */
export interface WidgetContext<DB = InferDB> {
  /** Your database client, exactly as handed to the adapter. */
  db: DB;
  session: Session | null;
  /** Range chosen in the dashboard's date picker, already resolved to dates. */
  dateRange: ResolvedDateRange;
  req: Request;
  /** Row of the record being viewed when the widget sits in a detail tab. */
  row?: Record<string, unknown>;
  /** Mount-aware link builder; never hand-type `"/admin/…"` in a config. */
  href: (
    resource: ResourceName,
    id?: string | number,
    opts?: { filter?: Record<string, unknown>; tab?: string },
  ) => string;
  /**
   * Memoises `fn` for the current request so two widgets share one query. A
   * failure is memoised too — the request does not retry under the same key.
   */
  query: <T>(key: string, fn: () => Promise<T>) => Promise<T>;
  /** The admin's resolved chrome strings, so a widget never hard-codes English. */
  labels: ResolvedLabels;
}

export type NumericFormat = "number" | "currency" | "percent" | "bytes" | "duration";
export type Tone = "default" | "accent" | "ok" | "warn" | "err" | "info" | "muted";
export type Span = 1 | 2 | 3 | 4 | 6 | 8 | 12;

/** Period-over-period change shown under a metric. */
export interface MetricDelta {
  /** Fractional change — `0.12` renders as +12%. */
  value: number;
  /** What the comparison is against, e.g. `"prior period"`. */
  vs: string;
  /** Which direction is good news. `"down"` colours a fall green.
   * @defaultValue "up"
   */
  goodWhen?: "up" | "down";
}

/** What a `metric()` query may return instead of a bare value. */
export interface MetricResult {
  value: number | string;
  tone?: Tone;
  sublabel?: string;
  delta?: MetricDelta;
  /** Turns the whole card into a link to this path. */
  href?: string;
}

export interface MetricOptions {
  /** Rendered as-is next to the label. Any string — an emoji, a ligature. No icon-name lookup exists. */
  icon?: string;
  /** How the number is rendered. */
  format?: NumericFormat;
  /** Small caption under the value. */
  sublabel?: string;
  /** Period-over-period change, queried alongside the value. */
  delta?: (ctx: WidgetContext) => Promise<MetricDelta | null>;
  /** Trend line drawn inside the card. */
  sparkline?: (ctx: WidgetContext) => Promise<number[]>;
  /** Semantic color of the value. */
  tone?: Tone;
  /** Turns the whole card into a link to this path. */
  drilldown?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
}

export interface MetricWidget {
  kind: "metric";
  label: string;
  query: (ctx: WidgetContext) => Promise<number | string | MetricResult>;
  options: MetricOptions;
}

/** Keys of a widget's query row — any string while the row type is unknown. */
export type RowKey<R> = unknown extends R ? string : keyof R & string;

/** A column a widget's own `query` produced, named and formatted by the config. */
export interface WidgetColumn<R = unknown> {
  field: RowKey<R>;
  label?: string;
  format?: ColumnFormat;
  align?: "left" | "center" | "right";
  width?: number | string;
}

export interface TableWidgetOptions<R = unknown> {
  /** Card heading. */
  label?: string;
  /** Registered resource to pull rows and columns from. */
  resource?: ResourceName;
  /** Supply rows yourself instead of reading a resource. */
  query?: (ctx: WidgetContext) => Promise<R[]>;
  /**
   * Columns to show. Defaults to the resource's own list columns. A bare key
   * takes the resource's declared header, or a humanised one; give an object to
   * name and format a column the query produced itself.
   */
  columns?: Array<RowKey<R> | WidgetColumn<R>>;
  /**
   * Which field identifies a row. Defaults to the resource's own key, and to
   * `"id"` for a `query`. A row without one renders but is never acted on.
   */
  rowKey?: RowKey<R>;
  /** Turn each row into a link. Return `null` to leave a row inert. */
  rowHref?: (row: R, ctx: WidgetContext) => string | null;
  /**
   * Link the card heading to the resource's list. `true` needs a `resource`;
   * a string is used as the href verbatim.
   */
  seeAll?: boolean | string;
  /**
   * Row cap. An explicit value caps both paths; the default applies to the
   * `resource` read, while a `query`'s own rows are left alone unless you set it.
   * @defaultValue 10
   */
  limit?: number;
  /** Rendered in place of the table body when there are zero rows. */
  emptyState?: ReactNode;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
}

export interface TableWidget {
  kind: "table";
  options: TableWidgetOptions;
}

export interface CustomOptions {
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Re-render when any of these channels fire. */
  realtime?: string | string[];
  /** Wrap the component in the standard widget card.
   * @defaultValue true
   */
  frame?: boolean;
}

export interface CustomWidget<P = unknown> {
  kind: "custom";
  Component: ComponentType<P>;
  props: P | ((ctx: WidgetContext) => Promise<P>);
  options: CustomOptions;
}

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
  /** Wraps the whole chart card in a link, mirroring MetricCard's whole-card drilldown. */
  drilldown?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
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
  /** Wraps the whole chart card in a link, mirroring MetricCard's whole-card drilldown. */
  drilldown?: string;
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

export type WidgetConfig =
  | MetricWidget
  | TableWidget
  | CustomWidget
  | StatGroupWidget
  | StatWidget
  | KvWidget
  | BarsWidget
  | FunnelWidget
  | ListWidget
  | AreaChartWidget
  | BarChartWidget
  | LineChartWidget
  | PieChartWidget;
