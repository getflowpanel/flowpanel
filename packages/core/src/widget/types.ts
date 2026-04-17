/**
 * Widget types for FlowPanel dashboards.
 *
 * A widget is a data-fetching card rendered on a Dashboard page or in a detail
 * drawer. Widgets are defined with pure async functions that receive ctx.db;
 * the server evaluates them and returns structured data that the client renders.
 */

import type { Row } from "../resource/types";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

export interface WidgetLayout {
  /** Column span in a 12-col grid. Default 4 for metric, 6 for list, 12 for chart/custom. */
  span?: 1 | 2 | 3 | 4 | 6 | 8 | 12;
}

export interface WidgetBase {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  layout?: WidgetLayout;
}

// ---------------------------------------------------------------------------
// Metric widget: single value + optional trend
// ---------------------------------------------------------------------------

export interface MetricTrend {
  delta: number;
  deltaPercent?: number;
  period?: string;
  direction?: "up" | "down" | "flat";
}

export interface MetricWidgetConfig<TCtx> extends Omit<WidgetBase, "id"> {
  id?: string;
  format?: "number" | "money" | "percent" | "bytes" | "duration";
  /** Prefix shown before the value (e.g. "$"). */
  prefix?: string;
  /** Suffix shown after the value (e.g. "%"). */
  suffix?: string;
  value: (ctx: TCtx) => Promise<number | string | null>;
  trend?: (ctx: TCtx) => Promise<MetricTrend | null>;
  sublabel?: string | ((ctx: TCtx) => Promise<string | null>);
}

export interface ResolvedMetricWidget extends WidgetBase {
  type: "metric";
  format?: "number" | "money" | "percent" | "bytes" | "duration";
  prefix?: string;
  suffix?: string;
  value: (ctx: unknown) => Promise<number | string | null>;
  trend?: (ctx: unknown) => Promise<MetricTrend | null>;
  sublabel?: string | ((ctx: unknown) => Promise<string | null>);
}

// ---------------------------------------------------------------------------
// List widget: array of rows with compact render config
// ---------------------------------------------------------------------------

export interface ListItem {
  primary: string;
  secondary?: string;
  meta?: string;
  href?: string;
  /** Badge value shown on the right. */
  badge?: string | number;
}

export interface ListWidgetConfig<TCtx, TRow = Row> extends Omit<WidgetBase, "id"> {
  id?: string;
  rows: (ctx: TCtx) => Promise<TRow[]>;
  /** How to render each row into a compact list item. */
  render: (row: TRow) => ListItem;
  /** Max items to render. Server truncates to this before sending. Default 10. */
  limit?: number;
  emptyMessage?: string;
}

export interface ResolvedListWidget extends WidgetBase {
  type: "list";
  rows: (ctx: unknown) => Promise<Row[]>;
  render: (row: Row) => ListItem;
  limit?: number;
  emptyMessage?: string;
}

// ---------------------------------------------------------------------------
// Chart widget: simple bar/line/area series
// ---------------------------------------------------------------------------

export interface ChartBucket {
  label: string;
  value: number;
}

export interface ChartWidgetConfig<TCtx> extends Omit<WidgetBase, "id"> {
  id?: string;
  kind?: "bar" | "line" | "area";
  data: (ctx: TCtx) => Promise<ChartBucket[]>;
  /** Optional color override (hex / CSS color). */
  color?: string;
  format?: "number" | "money" | "duration";
}

export interface ResolvedChartWidget extends WidgetBase {
  type: "chart";
  kind: "bar" | "line" | "area";
  data: (ctx: unknown) => Promise<ChartBucket[]>;
  color?: string;
  format?: "number" | "money" | "duration";
}

// ---------------------------------------------------------------------------
// Custom widget: user-provided React component + async data
// ---------------------------------------------------------------------------

export interface CustomWidgetConfig<TCtx, TData = unknown> extends Omit<WidgetBase, "id"> {
  id: string;
  /** Loader that runs server-side and returns JSON-serializable data. */
  data?: (ctx: TCtx) => Promise<TData>;
  /** React component reference (only used client-side; server ignores it). */
  component?: unknown;
}

export interface ResolvedCustomWidget extends WidgetBase {
  type: "custom";
  data?: (ctx: unknown) => Promise<unknown>;
  component?: unknown;
}

// ---------------------------------------------------------------------------
// Widget builder + resolved / serialized unions
// ---------------------------------------------------------------------------

export type ResolvedWidget =
  | ResolvedMetricWidget
  | ResolvedListWidget
  | ResolvedChartWidget
  | ResolvedCustomWidget;

export interface WidgetBuilder<TCtx = unknown> {
  metric(config: MetricWidgetConfig<TCtx>): ResolvedWidget;
  list<TRow = Row>(config: ListWidgetConfig<TCtx, TRow>): ResolvedWidget;
  chart(config: ChartWidgetConfig<TCtx>): ResolvedWidget;
  custom<TData = unknown>(config: CustomWidgetConfig<TCtx, TData>): ResolvedWidget;
}

/** Dashboard definition accepts an array of resolved widgets or a builder function. */
export type DashboardConfig<TCtx = unknown> =
  | ResolvedWidget[]
  | ((w: WidgetBuilder<TCtx>) => ResolvedWidget[]);

// ---------------------------------------------------------------------------
// Serialized (client-safe) widget — no functions
// ---------------------------------------------------------------------------

interface SerializedWidgetBase {
  id: string;
  label: string;
  icon?: string;
  description?: string;
  layout?: WidgetLayout;
}

export interface SerializedMetricWidget extends SerializedWidgetBase {
  type: "metric";
  format?: MetricWidgetConfig<unknown>["format"];
  prefix?: string;
  suffix?: string;
}

export interface SerializedListWidget extends SerializedWidgetBase {
  type: "list";
  emptyMessage?: string;
}

export interface SerializedChartWidget extends SerializedWidgetBase {
  type: "chart";
  kind: "bar" | "line" | "area";
  color?: string;
  format?: ChartWidgetConfig<unknown>["format"];
}

export interface SerializedCustomWidget extends SerializedWidgetBase {
  type: "custom";
}

export type SerializedWidget =
  | SerializedMetricWidget
  | SerializedListWidget
  | SerializedChartWidget
  | SerializedCustomWidget;

// ---------------------------------------------------------------------------
// Data payload returned from tRPC `dashboard.data`
// ---------------------------------------------------------------------------

export interface MetricWidgetData {
  type: "metric";
  value: number | string | null;
  trend: MetricTrend | null;
  sublabel: string | null;
}

export interface ListWidgetData {
  type: "list";
  items: ListItem[];
}

export interface ChartWidgetData {
  type: "chart";
  buckets: ChartBucket[];
}

export interface CustomWidgetData {
  type: "custom";
  data: unknown;
}

export type WidgetData =
  | MetricWidgetData
  | ListWidgetData
  | ChartWidgetData
  | CustomWidgetData
  | { type: "error"; error: string };

export interface DashboardData {
  widgets: Record<string, WidgetData>;
}
