import type { ComponentType, ReactNode } from "react";
import type { MetricCountSource } from "./metric-count";
import type { RealtimeOption } from "./realtime";
import type { ResourceName } from "./registry";
import type { ColumnFormat } from "./resource";
import type { Threshold } from "./threshold";
import type { ChecklistWidget, HeatmapWidget } from "./widget-activity";
import type { CaptionOptions } from "./widget-caption";
import type {
  BarsWidget,
  FunnelWidget,
  KvWidget,
  ListWidget,
  StatGroupWidget,
  StatWidget,
} from "./widget-cards";
import type {
  AreaChartWidget,
  BarChartWidget,
  LineChartWidget,
  PieChartWidget,
} from "./widget-charts";
import type { Link, LinkTarget, WidgetContext } from "./widget-context";
import type { TimelineWidget } from "./widget-timeline";
import type { TrackerWidget } from "./widget-tracker";

export type NumericFormat = "number" | "currency" | "percent" | "bytes" | "duration";
export type Tone = "default" | "accent" | "ok" | "warn" | "err" | "info" | "muted";
export type Span = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
/** A number of days, e.g. `"30d"`. */
export type RangeLimit = `${number}d`;

/** Period-over-period change shown under a metric. */
export interface MetricDelta {
  /** Fractional change — `0.12` renders as +12%. Inside ±1% the card shows no direction. */
  value: number;
  /** What the comparison is against, e.g. `"prior period"`. */
  vs: string;
  /**
   * Which direction is good news. `"down"` colours a fall green; `"neutral"` never colours.
   * @defaultValue "up"
   * @deprecated Set `goodWhen` on the metric; a delta's own still wins.
   */
  goodWhen?: "up" | "down" | "neutral";
  /**
   * The value compared against, shown muted beside the change. A count under 20 shows the
   * absolute change (`+3`); a `percent` metric shows percentage points (`+3 pp`).
   */
  previous?: number;
}

/** What a `metric()` query may return instead of a bare value. */
export interface MetricResult {
  value: number | string;
  tone?: Tone;
  sublabel?: string;
  delta?: MetricDelta;
  /** Turns the whole card into a link — a path or a named target. */
  href?: LinkTarget;
  /** Observations behind the value, compared with `tones.min`. */
  volume?: number;
}

export interface MetricOptions extends CaptionOptions {
  /** Rendered as-is next to the label. Any string — an emoji, a ligature. No icon-name lookup exists. */
  icon?: string;
  /** How the number is rendered. */
  format?: NumericFormat;
  /** Small caption under the value. */
  sublabel?: string;
  /** Period-over-period change, queried alongside the value. */
  delta?: (ctx: WidgetContext) => Promise<MetricDelta | null>;
  /**
   * Query the compared period too and show the change: `previous`, or `against: "weekAgo"` for
   * the same range seven days back. Needs a numeric value; a `delta` the query returns wins.
   */
  compare?: boolean | { against?: "previous" | "weekAgo" };
  /**
   * Which direction is good news: it colours the change, and `tones` must agree with it.
   * `"neutral"` never colours the change.
   * @defaultValue "up"
   */
  goodWhen?: "up" | "down" | "neutral";
  /** Trend line drawn inside the card. */
  sparkline?: (ctx: WidgetContext) => Promise<number[]>;
  /** Semantic color of the value. */
  tone?: Tone;
  /** Tone the value against a threshold; an explicit `tone` wins. */
  tones?: Threshold;
  /** Turns the whole card into a link — a path, a named target, or one computed from the context. */
  drilldown?: Link;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
}

export interface MetricWidget {
  kind: "metric";
  label: string;
  query: (ctx: WidgetContext) => Promise<number | string | MetricResult>;
  options: MetricOptions;
  /** What `metric(label, { count })` counts; absent for a metric with its own query. */
  source?: MetricCountSource;
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

export interface TableWidgetOptions<R = unknown> extends CaptionOptions {
  /** Card heading. */
  label?: string;
  /** A dashboard filter key: clicking a row sets it to the row's `rowKey` value on the current dashboard. */
  filterOnClick?: string;
  /** Registered resource to pull rows and columns from. */
  resource?: ResourceName;
  /** Supply rows yourself instead of reading a resource. */
  query?: (ctx: WidgetContext) => Promise<R[]>;
  /**
   * Narrow the `resource` read: a filter keyed by its fields, or one computed from the
   * context — `(c) => ({ userId: c.id })`. Values take the `ctx.read` shorthand; a missing
   * value throws instead of reading every row.
   */
  where?: Record<string, unknown> | ((ctx: WidgetContext) => Record<string, unknown>);
  /** A timestamp field of `resource` that the picked range bounds, as `ResourceLink.range` does. */
  range?: string;
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
  /** Turn each row into a link — a path or a named target. Return `null` to leave a row inert. */
  rowHref?: (row: R, ctx: WidgetContext) => LinkTarget | null;
  /**
   * Link the card heading. `true` links the `resource`'s own list; a `Link` names
   * any target, and a string is used as written.
   */
  seeAll?: boolean | Link;
  /**
   * Row cap. An explicit value caps both paths; the default applies to the
   * `resource` read, while a `query`'s own rows are left alone unless you set it.
   * @defaultValue 10
   */
  limit?: number;
  /** Rendered in place of the table body when there are zero rows. */
  emptyState?: ReactNode;
  /**
   * Row height: `"compact"` sets 40px rows for a card that lists a few.
   * @defaultValue "comfortable"
   */
  density?: "comfortable" | "compact";
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
}

export interface TableWidget {
  kind: "table";
  options: TableWidgetOptions;
}

export interface CustomOptions extends CaptionOptions {
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
  /** Wrap the component in the standard widget card.
   * @defaultValue true
   */
  frame?: boolean;
  /** The card's title when framed, and the name errors and slow-widget timings use. */
  label?: string;
}

export interface CustomWidget<P = unknown> {
  kind: "custom";
  Component: ComponentType<P>;
  props: P | ((ctx: WidgetContext) => Promise<P>);
  options: CustomOptions;
}

export type {
  AreaChartOptions,
  AreaChartWidget,
  BarChartOptions,
  BarChartWidget,
  ChartBucket,
  ChartOptionsBase,
  LineChartOptions,
  LineChartWidget,
  PieChartOptions,
  PieChartWidget,
} from "./widget-charts";

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
  | PieChartWidget
  | TimelineWidget
  | HeatmapWidget
  | ChecklistWidget
  | TrackerWidget;
