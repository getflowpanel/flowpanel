import type { ResourceName, RowOf } from "./registry";
import type { Where } from "./where";
import type { WidgetContext } from "./widget-context";

/** A metric that counts rows of a resource: its value is `ctx.count`, and it links to those rows. */
export interface MetricCount<N extends ResourceName = ResourceName> {
  /** The resource to count. */
  count: N;
  /** The rows to count, or a function of the widget context — `(c) => ({ userId: c.id })`. */
  where?: Where<RowOf<N>> | ((ctx: WidgetContext) => Where<RowOf<N>>);
  /** The timestamp field `ctx.dateRange` bounds; `compare` counts the period before it. */
  range?: keyof RowOf<N> & string;
}

/** What a count metric counts, kept on the widget so `defineAdmin` can check it. */
export interface MetricCountSource {
  resource: string;
  where?: Record<string, unknown> | ((ctx: WidgetContext) => Record<string, unknown>);
  range?: string;
  /** The card links to the counted rows, because it has no `drilldown` of its own. */
  linked: boolean;
}
