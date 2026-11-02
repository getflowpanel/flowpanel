import type { ReactNode } from "react";
import type { KeyLabels } from "../internal/key-labels";
import type { Fold } from "../runtime/series";
import type { RealtimeOption } from "./realtime";
import type { GoodWhen, Threshold } from "./threshold";
import type { NumericFormat, Span, Tone } from "./widget";
import type { CaptionOptions } from "./widget-caption";
import type { LinkTarget, WidgetContext } from "./widget-context";

/** One block of a folded tracker row. */
export interface TrackerCellResult {
  /** When the block's hour or day starts. */
  start: Date;
  value: number | null;
  /** Observations behind the value. */
  volume: number;
  tone: Tone;
}

/** One folded tracker row, as `summary` receives it. */
export interface TrackerRowResult {
  key: string;
  label: string;
  /** The worst tone of the last three blocks: the row's state right now. */
  tone: Tone;
  cells: TrackerCellResult[];
}

/** A block you built yourself, for the `rows` path. */
export interface TrackerCell {
  tone: Tone;
  /** Hover text and the block's accessible name. Default: the row label and the block's position, such as "Sync 1/2". */
  title?: string;
}

/** A row you built yourself, for the `rows` path. */
export interface TrackerRow {
  key: string;
  label: string;
  cells: TrackerCell[];
  /** Right-hand text. */
  summary?: string;
  /** Default: the worst tone of the last three blocks. */
  tone?: Tone;
  /** Where the row's label leads. */
  href?: LinkTarget;
}

export interface TrackerOptions<R = Record<string, unknown>> extends CaptionOptions {
  /** Card heading. */
  label?: string;
  /** A dashboard filter key: clicking a row sets it to the row's key on the current dashboard. */
  filterOnClick?: string;
  /** Rows over the window: `ctx.dateRange` is the window, not the picked range. */
  query?: (ctx: WidgetContext) => Promise<R[]>;
  /** The timestamp or `YYYY-MM-DD` field that places a row in a block. */
  at?: keyof R & string;
  /** One tracker row per value of this field. */
  by?: keyof R & string;
  /** Values of `by` always shown, in this order. */
  keys?: readonly string[];
  /** Row names per value of `by`: a map, an `enumOf()` or a function. */
  labels?: KeyLabels;
  /** A block's number: a field to sum or a function of its rows. Default: the row count. */
  value?: Fold<R>;
  /** Observations behind a block, compared with `tones.min`. Default: the row count. */
  volume?: Fold<R>;
  /** Tone each block by its value; without it a block with data is `accent`. */
  tones?: Threshold;
  /**
   * Which direction is good news; `tones` must agree with it.
   * @defaultValue "up"
   */
  goodWhen?: GoodWhen;
  /** How a block's value prints in its hover title. */
  format?: NumericFormat;
  /** Rows you built yourself, instead of `query`, `at` and `by`. */
  rows?: (ctx: WidgetContext) => Promise<TrackerRow[]>;
  /**
   * A window ending now, independent of the date picker: hourly blocks up to 48 hours, daily beyond.
   * @defaultValue "24h"
   */
  window?: `${number}h` | `${number}d`;
  /** Right-hand text per row, e.g. the last success; may query. */
  summary?: (row: TrackerRowResult, ctx: WidgetContext) => string | Promise<string>;
  /** Where a row's label leads. */
  rowHref?: (key: string, ctx: WidgetContext) => LinkTarget | null;
  /** Shown instead of the rows when there are none. Text or any node. */
  emptyState?: ReactNode;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
}

/** Status over time: one row per key, one block per hour or day of a window ending now. */
export interface TrackerWidget {
  kind: "tracker";
  options: TrackerOptions;
}
