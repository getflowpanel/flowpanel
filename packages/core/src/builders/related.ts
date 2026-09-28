import { humanize } from "../humanize";
import type { DetailTab } from "../types/detail";
import type { ResourceName, RowOf } from "../types/registry";
import type { WidgetConfig } from "../types/widget";

const RELATED = Symbol.for("flowpanel.related");

type Field<N extends ResourceName> = keyof RowOf<N> & string;
type Mark = { label: string; explicit: boolean };

/** A `related()` tab's options; field names are checked against the target's row. */
export interface RelatedOptions<N extends ResourceName = ResourceName> {
  /** The tab's URL key.
   * @defaultValue the resource name
   */
  key?: string;
  /** Tab label.
   * @defaultValue the target's `plural`, else its `label`, else its humanised name
   */
  label?: string;
  /** The target's field that points at the record. Omitted: inferred from its `reference`. */
  by?: Field<N>;
  /** Show the row count in the label.
   * @defaultValue true
   */
  count?: boolean;
  /** Rows per page.
   * @defaultValue 25
   */
  pageSize?: number;
  /** Default order of the rows. */
  sort?: { field: Field<N>; dir: "asc" | "desc" };
  /** Columns to leave out.
   * @defaultValue `[by]`
   */
  hide?: Field<N>[];
  /** Widgets above the rows, with `ctx.row` set to the record being viewed. */
  widgets?: WidgetConfig[];
  /** Grid columns for `widgets`. */
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  /** Shown instead of the generic label when there are no rows. */
  emptyState?: string;
  /** Hide the tab for records that should not show it. */
  hidden?: (row: Record<string, unknown>) => boolean;
}

/** The label `related()` chose and whether the host named it; `null` for a plain tab. */
export function relatedMark(tab: object): Mark | null {
  return (tab as { [RELATED]?: Mark })[RELATED] ?? null;
}

/**
 * A related tab in one line: the rows of `resource` that point at the viewed record, counted
 * in the label. `by`, `hide` and `sort` are checked against the target's row.
 */
export function related<N extends ResourceName>(
  resource: N,
  options: RelatedOptions<N> = {},
  // biome-ignore lint/suspicious/noExplicitAny: a tab joins any resource's detail.tabs; its own fields are checked against the target instead.
): Omit<DetailTab<any>, "fields" | "sections"> {
  const label = options.label ?? humanize(resource);
  // biome-ignore lint/suspicious/noExplicitAny: the tab this function returns.
  const tab: DetailTab<any> = {
    key: options.key ?? resource,
    label,
    resource,
    count: options.count ?? true,
    ...(options.by !== undefined ? { by: options.by } : {}),
    ...(options.pageSize !== undefined ? { pageSize: options.pageSize } : {}),
    ...(options.sort ? { sort: options.sort } : {}),
    ...(options.hide ? { hide: options.hide } : {}),
    ...(options.widgets ? { widgets: options.widgets } : {}),
    ...(options.columns ? { columns: options.columns } : {}),
    ...(options.emptyState !== undefined ? { emptyState: options.emptyState } : {}),
    ...(options.hidden ? { hidden: options.hidden } : {}),
  };
  return Object.assign(tab, { [RELATED]: { label, explicit: options.label !== undefined } });
}
