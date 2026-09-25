import type { PluralLabel } from "./labels";
import type { RealtimeOption } from "./realtime";
import type { RowOf } from "./registry";
import type { Where } from "./where";
import type { RangeLimit, Span, Tone } from "./widget";
import type { CaptionOptions } from "./widget-caption";
import type { LinkTarget, WidgetContext } from "./widget-context";

/** Rows a heatmap counts, or sums, per day. */
export interface HeatmapSource<N extends string = string> {
  resource: N;
  /** A timestamp, bucketed in the admin's zone, or a `YYYY-MM-DD` day. */
  at: keyof RowOf<N> & string;
  /** Sum this field instead of counting rows. */
  value?: keyof RowOf<N> & string;
  /** The field that points at the viewed record when several do; mirrors `DetailTab.by`. */
  by?: keyof RowOf<N> & string;
  /** Narrows the rows. On a record page the filter to the viewed record is always AND-ed in. */
  where?: Where<RowOf<N>> | ((ctx: WidgetContext) => Where<RowOf<N>>);
}

export interface HeatmapOptions<N extends string = string> extends CaptionOptions {
  /** Card heading. */
  label?: string;
  /** Rows of a resource over the last `days` days, at most 10,000; past that, use `query`. */
  source?: HeatmapSource<N>;
  /** Totals per day instead of `source`: `at` is a `Date` or a `YYYY-MM-DD` day. */
  query?: (ctx: WidgetContext) => Promise<Array<{ at: Date | string; value: number }>>;
  /**
   * Days shown, ending today, from 7 to 371.
   * @defaultValue 91
   */
  days?: number;
  /** What a day's value counts, for the summary and each day's tooltip. */
  unit?: string | PluralLabel;
  /**
   * The fill of a busy day.
   * @defaultValue "accent"
   */
  tone?: Tone;
  /** Makes each day a link; `from` and `to` bound the day in the admin's zone. */
  href?: (day: { from: Date; to: Date }, ctx: WidgetContext) => LinkTarget | null;
  /** Shown instead of the grid when every day is empty. */
  emptyState?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Ignored: a heatmap always shows its last `days` days, whatever the picked range. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these channels fire. */
  realtime?: RealtimeOption;
}

/** How often, day by day: weeks side by side, a cell per day shaded by its value. */
export interface HeatmapWidget {
  kind: "heatmap";
  options: HeatmapOptions;
}

/** One fact or step of a `checklist()` card. */
export interface ChecklistItem {
  label: string;
  /**
   * Done unless `null`, `undefined`, `false`, a blank string or an empty list; `0` counts.
   * A `Date` or an ISO string also says when, shown by an `ordered` checklist.
   */
  done: unknown;
  /** A muted note under the label. */
  hint?: string;
  /** Not counted in the summary; muted while not done. */
  optional?: boolean;
  /**
   * The mark's color when done.
   * @defaultValue "ok"
   */
  tone?: Tone;
  /** Links the label — a path or a named target. */
  href?: LinkTarget;
  /** The date has no clock: print the day, and measure no gap to or from it. A bare `YYYY-MM-DD` needs no flag. */
  precision?: "day";
}

export interface ChecklistOptions extends CaptionOptions {
  /** Card heading. */
  label?: string;
  /** The items, or a function that reads them per request. */
  items: ChecklistItem[] | ((ctx: WidgetContext) => Promise<ChecklistItem[]>);
  /** Each done step shows when, and the time since the previous done step. */
  ordered?: boolean;
  /**
   * `"steps"` lays the items out in a row from the `md` breakpoint.
   * @defaultValue "list"
   */
  layout?: "list" | "steps";
  /**
   * "7 of 12" with a bar; optional items are not counted.
   * @defaultValue true
   */
  summary?: boolean;
  /** Shown instead of the items when there are none. */
  emptyState?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run when any of these channels fire. */
  realtime?: RealtimeOption;
}

/** What is done and what is not, with a summary, and dates and gaps when ordered. */
export interface ChecklistWidget {
  kind: "checklist";
  options: ChecklistOptions;
}
