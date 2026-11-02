import type { ReactNode } from "react";
import type { EnumDef, EnumEntry } from "../builders/enum-of";
import type { RealtimeOption } from "./realtime";
import type { ResourceName } from "./registry";
import type { Where } from "./where";
import type { RangeLimit, Span, Tone } from "./widget";
import type { CaptionOptions } from "./widget-caption";
import type { LinkTarget, WidgetContext } from "./widget-context";

/** One thing that happened, as one line of a timeline. */
export interface TimelineEvent {
  at: Date;
  /** A key of the timeline's `kinds`. */
  kind: string;
  title: string;
  /** Trailing detail — an amount, an owner, a platform. */
  meta?: string;
  /** Longer text, folded under the line. */
  body?: string;
  /** The dot's color. Default: the kind's tone. */
  tone?: Tone;
  /** Links the title — a path or a named target. */
  href?: LinkTarget;
  /** Consecutive events of one day and one kind with the same `fold` become one line. Default: the title. */
  fold?: string;
  /** A stable identity for the line. */
  key?: string;
}

/** The page a timeline's `query` answers. */
export interface TimelinePage {
  /** Events at or before this moment; `null` for the newest page. */
  before: Date | null;
  /** Events to return at most: the page size, the ties already shown, and one more. */
  limit: number;
  /** The kinds the reader picked; `null` for every kind. */
  kinds: readonly string[] | null;
}

export interface TimelineOptions extends CaptionOptions {
  /** Card heading. */
  label?: string;
  /** The kinds — a chip each, with its label and tone. An `enumOf` works as is. */
  kinds: EnumDef | Record<string, EnumEntry>;
  /** Events that are not rows of a resource. */
  query?: (ctx: WidgetContext, page: TimelinePage) => Promise<TimelineEvent[]>;
  /** Resources read as events, merged with `query` by time; build each with `timeline.source`. */
  sources?: TimelineSource[];
  /**
   * Group lines under days of the admin's zone; `false` for one list.
   * @defaultValue "day"
   */
  group?: "day" | false;
  /**
   * Events per page, from 1 to 200.
   * @defaultValue 50
   */
  pageSize?: number;
  /**
   * The URL namespace of the chips and the paging, `?<id>.kind=` and `?<id>.before=`; unique per page.
   * @defaultValue the detail tab's key, else "timeline", "timeline-2", … in page order
   */
  id?: string;
  /** Shown instead of the lines when nothing happened. Text or any node. */
  emptyState?: ReactNode;
  /** Width in the dashboard's 12-column grid. */
  span?: Span;
  /** Cap the date range at its last N days — `"30d"` — for data kept only that long. */
  maxRange?: RangeLimit;
  /** Re-run the query when any of these fire: a channel name, or `{ resource }` for that resource's own changes. */
  realtime?: RealtimeOption;
}

/** What happened, newest first, grouped by day, with a chip per kind and paging. */
export interface TimelineWidget {
  kind: "timeline";
  options: TimelineOptions;
}

/** Rows of a resource read as timeline events, one authorized read per page. */
export interface TimelineSource<R = Record<string, unknown>> {
  resource: ResourceName;
  /**
   * A fixed kind, or the field that holds each row's kind. With a field the chips narrow the
   * read to the picked kinds, and a missing `title` prints the kind's label.
   */
  kind: string | { field: keyof R & string };
  /** The timestamp; a row without one is not an event. */
  at: keyof R & string;
  /** The field that points at the viewed record when several do; mirrors `DetailTab.by`. */
  by?: keyof R & string;
  /**
   * Narrows the rows. On a record page the filter to the viewed record is always AND-ed in and
   * `where` cannot set its field; on a dashboard the source reads the picked range.
   */
  where?: Where<R> | ((ctx: WidgetContext) => Where<R>);
  /** The line's title. Default: the kind's label. */
  title?:
    | string
    | ((row: R, refs: Readonly<Record<string, string | null>>, ctx: WidgetContext) => string);
  /** Trailing detail. */
  meta?: (
    row: R,
    refs: Readonly<Record<string, string | null>>,
    ctx: WidgetContext,
  ) => string | null | undefined;
  /** Longer text, folded under the line. */
  body?: (row: R, ctx: WidgetContext) => string | null | undefined;
  /** The dot's color. Default: the kind's tone. */
  tone?: Tone | ((row: R) => Tone | undefined);
  /** Reference columns whose labels `title` and `meta` read, resolved in one read per page. */
  refs?: (keyof R & string)[];
  /** Default: the first `refs` record, else the row as its list opens it. `false`: no link. */
  href?: false | ((row: R, ctx: WidgetContext) => LinkTarget | null);
  /** One fold key for every event of the source. */
  fold?: string;
  /** More fields the callbacks read, beyond the list's columns. */
  fields?: (keyof R & string)[];
}
