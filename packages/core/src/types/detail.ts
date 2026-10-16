import type { ReactNode } from "react";
import type { DateRangeConfig } from "./dashboard";
import type { ResolvedLabels } from "./labels";
import type { ResourceName } from "./registry";
import type { FieldDef } from "./resource";
import type { MetricWidget, Tone, WidgetConfig } from "./widget";
import type { StatWidget } from "./widget-cards";
import type { LinkTarget, WidgetContext, WidgetFormat } from "./widget-context";

/**
 * What a `DetailTab.render` callback is handed alongside the row: the widget
 * context minus the parts a detail tab has no business with.
 */
export interface DetailTabContext
  extends Pick<
    WidgetContext,
    | "db"
    | "session"
    | "dateRange"
    | "labels"
    | "query"
    | "sql"
    | "count"
    | "read"
    | "rowOf"
    | "id"
    | "format"
    | "link"
  > {}

export interface DetailTab<Row> {
  /** Stable identifier, stored in the URL's `?tab=` search parameter. */
  key: string;
  /** Tab label. */
  label: string;
  /** Hide the tab for rows that should not show it. */
  hidden?: (row: Row) => boolean;
  /** Field list to render as a key/value view. `"*"` shows every column. */
  fields?: (keyof Row | FieldDef<Row>)[] | "*";
  /** Grouped key/value fields, one block per entry. Wins over `fields`. */
  sections?: Array<{ label: string; fields: (keyof Row | FieldDef<Row>)[] }>;
  /** Render rows of a related resource instead of fields. */
  resource?: ResourceName;
  /** Filter applied to `resource`, derived from the row being viewed. */
  filter?: (row: Row) => Record<string, unknown>;
  /**
   * The target's field that points at this record; becomes `filter` and `hide` unless those are given.
   * A `related()` tab infers it from the one target column whose `reference.resource` is this resource.
   */
  by?: string;
  /**
   * Show the row count in the tab's label — `"Responses · 12"`.
   * @defaultValue false; true through `related()`
   */
  count?: boolean;
  /**
   * Related rows per page.
   * @defaultValue 25
   */
  pageSize?: number;
  /** Related-tab columns to omit, typically the parent foreign key. */
  hide?: string[];
  /** Related-tab default sort; falls back to the target's `defaultSort`, then its primary key. */
  sort?: { field: string; dir: "asc" | "desc" };
  /** Dashboard widgets with `ctx.row` set to the record being viewed; with `resource`, above its rows. */
  widgets?: WidgetConfig[];
  /** Grid columns for `widgets`; omitted, 12 when a widget sets `span`, 1 for a single widget, else 2. */
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  /** Render arbitrary content instead of fields, widgets or a related resource. */
  render?: (row: Row, ctx: DetailTabContext) => ReactNode;
  /**
   * Shown instead of the generic label when the tab has nothing to show: no related
   * rows, no widgets, or no fields the reader may see.
   */
  emptyState?: string;
}

type MaybePromise<T> = T | Promise<T>;

/** What a record page's header callbacks receive beside the row. */
export interface DetailHeaderContext {
  /** The admin's formatters — locale, zone and currency from `formatting`. */
  format: WidgetFormat;
  /** The admin's resolved chrome strings. */
  labels: ResolvedLabels;
  /** Resolves a link target to an href under the admin's mount. */
  link: (target: LinkTarget) => string;
}

/** One pill beside a record page's heading. */
export interface DetailBadge {
  label: string;
  tone?: Tone;
  /** Makes the pill a link — a path or a named target. */
  href?: LinkTarget;
}

/** A resource's full-page record view at `<paths.admin>/<resource>/<id>`. */
export interface DetailOptions<Row> {
  /**
   * Extra fields used only by detail headers, hidden-tab predicates, related
   * filters, or custom detail renderers. They never widen list rows.
   */
  expose?: (keyof Row & string)[];
  /** Heading content (inside h1). Receives declared, readable detail fields; nullish output uses `<label> · <pk>`. */
  title?: (row: Row, ctx: DetailHeaderContext) => ReactNode | string | null | undefined;
  /** One line under the heading, for the fact that identifies the record. May be async. */
  subtitle?: (row: Row, ctx: DetailHeaderContext) => MaybePromise<string | null | undefined>;
  /** Pills beside the heading: one, or several in order; nullish entries are dropped. May be async. */
  badge?: (
    row: Row,
    ctx: DetailHeaderContext,
  ) => MaybePromise<DetailBadge | ReadonlyArray<DetailBadge | null | undefined> | null | undefined>;
  /**
   * A date picker in the header; its range, with `previous`, reaches `stats`, `aside` and every widgets tab.
   * Omitted: the whole history, and no picker.
   */
  dateRange?: DateRangeConfig;
  /** Numbers in a hairline strip under the header, on every tab. */
  stats?: Array<StatWidget | MetricWidget>;
  /** Widgets in a column beside the tabs from the `lg` breakpoint, below them on a phone, on every tab. */
  aside?: WidgetConfig[];
  tabs?: DetailTab<Row>[];
  fields?: (keyof Row | FieldDef<Row>)[] | "*";
  /**
   * The History tab, listing this record's audit events. Shown when the audit log table is on.
   * @defaultValue true
   */
  history?: boolean;
}
