import type { ComponentType, ReactNode } from "react";
import type { ResolvedDateRange } from "./dashboard.js";
import type { InferDB } from "./registry.js";
import type { Session } from "./session.js";

/** Server-side context passed to every widget `query` function. */
export interface WidgetContext<DB = InferDB> {
  db: DB;
  session: Session | null;
  dateRange: ResolvedDateRange;
  req: Request;
}

export type NumericFormat = "number" | "currency" | "percent" | "bytes" | "duration";
export type Tone = "default" | "accent" | "success" | "warning" | "danger" | "muted";
export type Span = 1 | 2 | 3 | 4 | 6 | 8 | 12;

export interface MetricDelta {
  value: number;
  vs: string;
}

export interface MetricOptions {
  icon?: string;
  format?: NumericFormat;
  sublabel?: string;
  delta?: (ctx: WidgetContext) => Promise<MetricDelta | null>;
  sparkline?: (ctx: WidgetContext) => Promise<number[]>;
  tone?: Tone;
  drilldown?: string;
  drawer?: { resource: string; id?: (value: unknown) => string };
  span?: Span;
  realtime?: string | string[];
}

export interface MetricWidget {
  kind: "metric";
  label: string;
  query: (ctx: WidgetContext) => Promise<number | string>;
  options: MetricOptions;
}

export interface TableWidgetOptions {
  label?: string;
  resource?: string;
  query?: (ctx: WidgetContext) => Promise<unknown[]>;
  columns?: string[];
  limit?: number;
  rowClick?: "drawer" | "detail" | ((row: unknown) => void);
  emptyState?: ReactNode;
  realtime?: string | string[];
  span?: Span;
}

export interface TableWidget {
  kind: "table";
  options: TableWidgetOptions;
}

export interface CustomOptions {
  span?: Span;
  realtime?: string | string[];
}

export interface CustomWidget<P = unknown> {
  kind: "custom";
  Component: ComponentType<P>;
  props: P | ((ctx: WidgetContext) => Promise<P>);
  options: CustomOptions;
}

export interface StatItem {
  label: string;
  value: unknown | ((ctx: WidgetContext, row?: unknown) => Promise<unknown>);
  format?: NumericFormat;
  tone?: Tone;
}

export interface StatGroupOptions {
  label?: string;
  stats: StatItem[];
  span?: Span;
}

export interface StatGroupWidget {
  kind: "statGroup";
  options: StatGroupOptions;
}

/** Charts are defined in @flowpanel/charts but their config lives in core. */
export interface ChartOptionsBase {
  x: string;
  y: string | string[];
  height?: number;
  format?: NumericFormat;
  tooltip?: "default" | "compact" | false;
  drilldown?: string;
  span?: Span;
  realtime?: string | string[];
}

export interface AreaChartOptions extends ChartOptionsBase {
  stacked?: boolean;
  smooth?: boolean;
}
export interface BarChartOptions extends ChartOptionsBase {
  stacked?: boolean;
  horizontal?: boolean;
}
export interface LineChartOptions extends ChartOptionsBase {
  smooth?: boolean;
  markers?: boolean;
}
export interface PieChartOptions {
  category: string;
  value: string;
  donut?: boolean;
  showLegend?: boolean;
  height?: number;
  span?: Span;
  drilldown?: string;
  realtime?: string | string[];
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
  | AreaChartWidget
  | BarChartWidget
  | LineChartWidget
  | PieChartWidget;
