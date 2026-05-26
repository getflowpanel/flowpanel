import type { ComponentType } from "react";
import type {
  CustomOptions,
  CustomWidget,
  MetricOptions,
  MetricWidget,
  StatGroupOptions,
  StatGroupWidget,
  TableWidget,
  TableWidgetOptions,
  WidgetContext,
} from "../types/widget.js";

/**
 * A single big-number widget. `query` runs server-side and receives the
 * typed `ctx.db` (when augmented via `FlowpanelTypes`), `session`, and
 * `dateRange`. The return value can be a `number` (auto-formatted per
 * `options.format`) or a pre-formatted `string`.
 *
 * @example
 * ```ts
 * metric("Active users", async ({ db, dateRange }) => {
 *   const [{ c }] = await db
 *     .select({ c: sql<number>`count(*)` })
 *     .from(schema.users)
 *     .where(gte(schema.users.lastSeenAt, dateRange.from));
 *   return Number(c);
 * }, { format: "number", tone: "ok" })
 * ```
 */
export function metric(
  label: string,
  query: (ctx: WidgetContext) => Promise<number | string>,
  options: MetricOptions = {},
): MetricWidget {
  return {
    kind: "metric",
    label,
    query,
    options: { format: "number", ...options },
  };
}

/**
 * A list-of-rows widget on a dashboard. Either point at a registered
 * `resource` (inherits its columns + label + per-column renderers) or pass
 * `query` for ad-hoc data.
 *
 * @example
 * ```ts
 * table({ resource: "users", limit: 10, realtime: "resource.users" })
 * ```
 *
 * @example Ad-hoc
 * ```ts
 * table({
 *   label: "Top errors",
 *   query: async ({ db }) => db.select().from(schema.errors).limit(5),
 *   columns: ["message", "count"],
 * })
 * ```
 */
export function table(options: TableWidgetOptions): TableWidget {
  return { kind: "table", options };
}

/**
 * Drop a fully-custom React component into a dashboard section. Use when no
 * built-in widget kind fits — pipeline-flow visualizers, cost calculators,
 * etc. `props` may be a literal object or a `(ctx) => Promise<Props>` resolver
 * that runs server-side before render.
 *
 * @example
 * ```ts
 * custom(PipelineFlow, async ({ db }) => ({
 *   nodes: await db.select().from(schema.pipelines),
 * }))
 * ```
 */
export function custom<P>(
  Component: ComponentType<P>,
  props: P | ((ctx: WidgetContext) => Promise<P>),
  options: CustomOptions = {},
): CustomWidget<P> {
  return { kind: "custom", Component, props, options };
}

/**
 * A row of small stats (count + label) — denser than a grid of `metric()`
 * cards. Each stat's `value` may be a literal or a server-side resolver.
 *
 * @example
 * ```ts
 * statGroup({
 *   stats: [
 *     { label: "Free",  value: async ({ db }) => count(schema.users, eq(plan, "free")) },
 *     { label: "Pro",   value: async ({ db }) => count(schema.users, eq(plan, "pro")) },
 *     { label: "Team",  value: async ({ db }) => count(schema.users, eq(plan, "team")) },
 *   ],
 * })
 * ```
 */
export function statGroup(options: StatGroupOptions): StatGroupWidget {
  return { kind: "statGroup", options };
}
