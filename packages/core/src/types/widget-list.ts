import type { ReactNode } from "react";
import type { RealtimeOption } from "./realtime";
import type { RangeLimit, Span, Tone } from "./widget";
import type { CaptionOptions } from "./widget-caption";
import type { Link, LinkTarget, WidgetContext } from "./widget-context";

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
  /** Impact, shown right-aligned in the admin's locale: "37". */
  count?: number;
  /** When it started, shown relative in the admin's locale: "3 hours ago". */
  since?: Date | string;
}

export interface ListOptions extends CaptionOptions {
  /** Card heading. */
  label?: string;
  query: (ctx: WidgetContext) => Promise<ListRow[]>;
  /** Shown instead of the lines when the query returns nothing. Text or any node; the drawer shows only text. */
  emptyState?: ReactNode;
  /**
   * `"banner"`: a strip tinted by the worst row, rows ordered err → warn → info then by
   * `count`, each with a glyph; with no rows it shows `allClear`.
   * @defaultValue "list"
   */
  variant?: "list" | "banner";
  /** Rows shown; the rest become one "N more" line. */
  limit?: number;
  /** Where the "N more" line leads. */
  more?: Link;
  /** A banner's line when there are no rows. Default: `labels.widget.allClear`. */
  allClear?: string;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
}

/** A short feed — latest signups, failing jobs — where a table would be too much. */
export interface ListWidget {
  kind: "list";
  options: ListOptions;
}
