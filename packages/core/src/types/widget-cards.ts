import type { ReactNode } from "react";
import type { RealtimeOption } from "./realtime";
import type { ColumnFormat } from "./resource";
import type { GoodWhen, Threshold } from "./threshold";
import type { NumericFormat, RangeLimit, Span, Tone } from "./widget";
import type { CaptionOptions } from "./widget-caption";
import type { Link, LinkTarget, WidgetContext } from "./widget-context";

/** Display-safe literal returned by a stat resolver. */
export type StatValue = string | number | boolean | bigint | Date | null | undefined;

/**
 * What a `kv` or `statGroup` item resolver may return instead of a bare value. Its `tone` wins
 * over the item's own; its `href` links the value, and wins over a `kv` item's `href`.
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

export interface StatGroupOptions extends CaptionOptions {
  /** Card heading. */
  label?: string;
  /** Rows of the group, in order. */
  stats: StatItem[];
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
}

export interface StatGroupWidget {
  kind: "statGroup";
  options: StatGroupOptions;
}

export interface StatOptions extends CaptionOptions {
  /** Small caption under the value. */
  hint?: string;
  /** Turns the whole card into a link — a path, a named target, or one computed from the context. */
  href?: Link;
  /** Semantic color of the value. */
  tone?: Tone;
  /** Tone the value against a threshold; an explicit `tone` wins. */
  tones?: Threshold;
  /**
   * Which direction is good news; `tones` must agree with it.
   * @defaultValue "up"
   */
  goodWhen?: GoodWhen;
  /** How a numeric value is rendered. */
  format?: NumericFormat;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
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
  /** Observations behind the value, compared with `tones.min`. */
  volume?: number;
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
  /**
   * A paragraph across the card, line breaks kept; past `lines` lines the rest folds under "Show all".
   * @defaultValue false; `lines` defaults to 6
   */
  long?: boolean | { lines?: number };
  /** Printed instead of "—" when the value is missing or blank. */
  empty?: string;
}

export interface KvOptions<R = Record<string, unknown>> extends CaptionOptions {
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
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
}

/** A label/value card — the facts about one thing, not a table. */
export interface KvWidget {
  kind: "kv";
  options: KvOptions;
}

/** One bar of a `bars()` card, sized against `BarsOptions.max` or the largest value. */
export interface BarRow {
  /** Stable identity: `compare` joins the previous period by it, and a filter sets it. `breakdown()` fills it. */
  key?: string;
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

export interface BarsOptions extends CaptionOptions {
  /** Card heading. */
  label?: string;
  /** A dashboard filter key: clicking a bar sets it to the row's `key` on the current dashboard. */
  filterOnClick?: string;
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
  /**
   * Which direction is good news; colours each row's change ("neutral" doesn't), and `tones` must agree with it.
   * @defaultValue "up"
   */
  goodWhen?: "up" | "down" | "neutral";
  /** Tone each bar against a threshold by its value; a row's own `tone` wins. */
  tones?: Threshold;
  /**
   * Runs the query for the compared period too and fills each row's `previous`, joined by `key` then `label`.
   * No change shows past `maxRange` or over a whole history.
   */
  compare?: boolean | { against?: "previous" | "weekAgo" };
  /** Shown instead of the bars when the query returns nothing. Text or any node; the drawer shows only text. */
  emptyState?: ReactNode;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
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

export interface FunnelOptions extends CaptionOptions {
  /** Card heading. */
  label?: string;
  query: (ctx: WidgetContext) => Promise<FunnelStep[]>;
  /** How step values are rendered. */
  format?: NumericFormat;
  /**
   * Share lost from the step before, as a fraction, past which the step with the
   * largest drop is marked with the `warn` tone. Unset, no step is toned.
   */
  alertDrop?: number;
  /** Shown instead of the steps when the query returns nothing. Text or any node; the drawer shows only text. */
  emptyState?: ReactNode;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
}

/** Stages with a share of the first step and the drop-off from the one before. */
export interface FunnelWidget {
  kind: "funnel";
  options: FunnelOptions;
}

export type { ListOptions, ListRow, ListWidget } from "./widget-list";
