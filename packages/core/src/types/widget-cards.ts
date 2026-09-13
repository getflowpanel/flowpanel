import type { ColumnFormat } from "./resource";
import type { NumericFormat, Span, Tone, WidgetContext } from "./widget";

/** Display-safe literal returned by a stat resolver. */
export type StatValue = string | number | boolean | bigint | Date | null | undefined;

/** One row of a `statGroup`. */
export interface StatItem {
  label: string;
  /** A literal, or a function resolved per request. */
  value: StatValue | ((ctx: WidgetContext, row?: unknown) => Promise<StatValue>);
  format?: NumericFormat;
  tone?: Tone;
}

export interface StatGroupOptions {
  /** Card heading. */
  label?: string;
  /** Rows of the group, in order. */
  stats: StatItem[];
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Re-run the queries when any of these channels fire. */
  realtime?: string | string[];
}

export interface StatGroupWidget {
  kind: "statGroup";
  options: StatGroupOptions;
}

export interface StatOptions {
  /** Small caption under the value. */
  hint?: string;
  /** Turns the whole card into a link to this path. */
  href?: string;
  /** Semantic color of the value. */
  tone?: Tone;
  /** How a numeric value is rendered. */
  format?: NumericFormat;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
}

/** One number with a label — a `metric()` without the delta and sparkline machinery. */
export interface StatWidget {
  kind: "stat";
  label: string;
  value: StatValue | ((ctx: WidgetContext) => Promise<StatValue>);
  options: StatOptions;
}

/** One labelled row of a `kv()` card. */
export interface KvItem {
  label: string;
  /** A literal, or a function resolved per request. */
  value: StatValue | ((ctx: WidgetContext) => Promise<StatValue>);
  format?: ColumnFormat | NumericFormat;
  tone?: Tone;
  /** Renders the value as a link to this path. */
  href?: string;
}

export interface KvOptions {
  /** Card heading. */
  label?: string;
  /** Rows of the card, in order. */
  items: KvItem[];
  /** Rows per grid line.
   * @defaultValue 2
   */
  columns?: 1 | 2;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Re-run the queries when any of these channels fire. */
  realtime?: string | string[];
}

/** A label/value card — the facts about one thing, not a table. */
export interface KvWidget {
  kind: "kv";
  options: KvOptions;
}

/** One bar of a `bars()` card. The card sizes it against the largest value. */
export interface BarRow {
  label: string;
  value: number;
  href?: string;
  tone?: Tone;
}

export interface BarsOptions {
  /** Card heading. */
  label?: string;
  query: (ctx: WidgetContext) => Promise<BarRow[]>;
  /** How bar values are rendered. */
  format?: NumericFormat;
  /** Shown instead of the bars when the query returns nothing. */
  emptyState?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
}

/** A ranked breakdown — "top five plans by revenue" — without a chart bundle. */
export interface BarsWidget {
  kind: "bars";
  options: BarsOptions;
}

/** One stage of a `funnel()`. Give counts only; the card derives the rest. */
export interface FunnelStep {
  label: string;
  value: number;
  href?: string;
}

export interface FunnelOptions {
  /** Card heading. */
  label?: string;
  query: (ctx: WidgetContext) => Promise<FunnelStep[]>;
  /** How step values are rendered. */
  format?: NumericFormat;
  /** Shown instead of the steps when the query returns nothing. */
  emptyState?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
}

/** Stages with a share of the first step and the drop-off from the one before. */
export interface FunnelWidget {
  kind: "funnel";
  options: FunnelOptions;
}

/** One line of a `list()` card. */
export interface ListRow {
  text: string;
  /** Trailing detail — a timestamp, a count, an owner. */
  meta?: string;
  tone?: Tone;
  href?: string;
}

export interface ListOptions {
  /** Card heading. */
  label?: string;
  query: (ctx: WidgetContext) => Promise<ListRow[]>;
  /** Shown instead of the lines when the query returns nothing. */
  emptyState?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
}

/** A short feed — latest signups, failing jobs — where a table would be too much. */
export interface ListWidget {
  kind: "list";
  options: ListOptions;
}
