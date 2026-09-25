import type { ColumnFormat } from "./resource";
import type { NumericFormat, RangeLimit, Span, Tone } from "./widget";
import type { Link, LinkTarget, WidgetContext } from "./widget-context";

/** Display-safe literal returned by a stat resolver. */
export type StatValue = string | number | boolean | bigint | Date | null | undefined;

/**
 * What a `kv` or `statGroup` item resolver may return instead of a bare value, so
 * the value carries its own tone and link, as `StatResult` does for `stat()`. A
 * field set here wins over the item's static `tone` or `href`.
 */
export interface KvResult {
  value: StatValue;
  /** Semantic color of the value. */
  tone?: Tone;
  /** Renders the value as a link — a path or a named target. */
  href?: LinkTarget;
}

/** One row of a `statGroup`. */
export interface StatItem {
  label: string;
  /**
   * A literal, or a function resolved per request that may return a `KvResult`.
   * The record, in a detail tab, is `ctx.row`.
   */
  value: StatValue | ((ctx: WidgetContext) => Promise<StatValue | KvResult>);
  format?: NumericFormat;
  /** Semantic color of the value. */
  tone?: Tone;
}

export interface StatGroupOptions {
  /** Card heading. */
  label?: string;
  /** Rows of the group, in order. */
  stats: StatItem[];
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
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
  /** Turns the whole card into a link — a path, a named target, or one computed from the context. */
  href?: Link;
  /** Semantic color of the value. */
  tone?: Tone;
  /** How a numeric value is rendered. */
  format?: NumericFormat;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
}

/**
 * What a `stat()` resolver may return instead of a bare value, so a card computed
 * from data can carry its own tone, caption and link — `MetricResult` for `stat()`.
 */
export interface StatResult {
  value: StatValue;
  /** Semantic color of the value. */
  tone?: Tone;
  /** Small caption under the value. */
  hint?: string;
  /** Turns the whole card into a link — a path or a named target. */
  href?: LinkTarget;
}

/** A `stat()` value resolved per request. */
export type StatResolver = (ctx: WidgetContext) => Promise<StatValue | StatResult>;

/** One number with a label — a `metric()` without the delta and sparkline machinery. */
export interface StatWidget {
  kind: "stat";
  label: string;
  value: StatValue | StatResolver;
  options: StatOptions;
}

/** One labelled row of a `kv()` card. */
export interface KvItem<R = Record<string, unknown>> {
  label: string;
  /** A literal, or a function resolved per request that may return a `KvResult`. Omit it with `field`. */
  value?: StatValue | ((ctx: WidgetContext) => Promise<StatValue | KvResult>);
  /** A field of the card's `record` — the viewed row by default — shown instead of `value`. */
  field?: keyof R & string;
  format?: ColumnFormat | NumericFormat;
  /** Semantic color of the value. */
  tone?: Tone;
  /** Renders the value as a link — a path, a named target, or one computed from the context. */
  href?: Link;
}

export interface KvOptions<R = Record<string, unknown>> {
  /** Card heading. */
  label?: string;
  /** Rows of the card, in order. */
  items: KvItem<R>[];
  /**
   * The record `field` items read, resolved once per card. Omitted: the viewed record on a
   * record page, and nothing on a dashboard.
   */
  record?: (ctx: WidgetContext) => R | null | undefined | Promise<R | null | undefined>;
  /** Rows per grid line.
   * @defaultValue 2
   */
  columns?: 1 | 2;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the queries when any of these channels fire. */
  realtime?: string | string[];
}

/** A label/value card — the facts about one thing, not a table. */
export interface KvWidget {
  kind: "kv";
  options: KvOptions;
}

/** One bar of a `bars()` card, sized against `BarsOptions.max` or the largest value. */
export interface BarRow {
  label: string;
  value: number;
  /** Links the bar's label — a path or a named target. */
  href?: LinkTarget;
  /** Fill color of the bar. */
  tone?: Tone;
  /** The same row's value in the period before; the card marks the change. */
  previous?: number;
  /** This row's part of the real total, 0 to 1, for a top-N query; shown with `share`. */
  share?: number;
}

export interface BarsOptions {
  /** Card heading. */
  label?: string;
  query: (ctx: WidgetContext) => Promise<BarRow[]>;
  /** How bar values are rendered. */
  format?: NumericFormat;
  /**
   * The value a full bar stands for — `1` for a rate with `format: "percent"`.
   * Default, and for a value of `0` or less: the largest value in the rows.
   */
  max?: number;
  /** Show each row's part of the total beside its value: its own `share`, else of the rows' sum. */
  share?: boolean;
  /** Which direction of a row's change is good news.
   * @defaultValue "up"
   */
  goodWhen?: "up" | "down" | "neutral";
  /** Shown instead of the bars when the query returns nothing. */
  emptyState?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
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
  /** Links the step's label — a path or a named target. */
  href?: LinkTarget;
}

export interface FunnelOptions {
  /** Card heading. */
  label?: string;
  query: (ctx: WidgetContext) => Promise<FunnelStep[]>;
  /** How step values are rendered. */
  format?: NumericFormat;
  /**
   * Share lost from the step before, as a fraction, past which the step with the
   * largest drop is marked with the `warn` tone. `1` turns the mark off.
   * @defaultValue 0.5
   */
  alertDrop?: number;
  /** Shown instead of the steps when the query returns nothing. */
  emptyState?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
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
  /** Stable identity for the row, such as a record id. Default: its position. */
  key?: string;
  text: string;
  /** Trailing detail — a timestamp, a count, an owner. */
  meta?: string;
  /** A leading dot in this color; `warn` and `err` also color the text. */
  tone?: Tone;
  /** Links the line's text — a path or a named target. */
  href?: LinkTarget;
}

export interface ListOptions {
  /** Card heading. */
  label?: string;
  query: (ctx: WidgetContext) => Promise<ListRow[]>;
  /** Shown instead of the lines when the query returns nothing. */
  emptyState?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these channels fire. */
  realtime?: string | string[];
}

/** A short feed — latest signups, failing jobs — where a table would be too much. */
export interface ListWidget {
  kind: "list";
  options: ListOptions;
}
