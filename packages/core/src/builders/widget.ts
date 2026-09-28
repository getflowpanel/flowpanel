import type { ComponentType } from "react";
import { whereValue, withRange } from "../internal/where";
import { isFilterRangeValue } from "../types/context";
import type { MetricCount, MetricCountSource } from "../types/metric-count";
import type { ResourceName } from "../types/registry";
import type {
  CustomOptions,
  CustomWidget,
  MetricOptions,
  MetricResult,
  MetricWidget,
  TableWidget,
  TableWidgetOptions,
} from "../types/widget";
import type {
  BarsOptions,
  BarsWidget,
  FunnelOptions,
  FunnelWidget,
  KvOptions,
  KvWidget,
  ListOptions,
  ListWidget,
  StatGroupOptions,
  StatGroupWidget,
  StatOptions,
  StatWidget,
} from "../types/widget-cards";
import type { WidgetContext } from "../types/widget-context";
import type { TrackerOptions, TrackerWidget } from "../types/widget-tracker";

type MetricQuery = (ctx: WidgetContext) => Promise<number | string | MetricResult>;

function countSource(source: MetricCount, options: MetricOptions): MetricCountSource {
  return {
    resource: source.count,
    ...(source.where !== undefined ? { where: source.where } : {}),
    ...(source.range !== undefined ? { range: source.range } : {}),
    linked: options.drilldown === undefined,
  };
}

/**
 * A single big number that counts rows of a resource. The value is `ctx.count(count, where,
 * { range })`, `compare` counts the period before, and the card links to the counted rows.
 */
export function metric<N extends ResourceName>(
  label: string,
  source: MetricCount<N>,
  options?: MetricOptions,
): MetricWidget;
/** A single big-number widget. */
export function metric(label: string, query: MetricQuery, options?: MetricOptions): MetricWidget;
export function metric(
  label: string,
  source: MetricQuery | MetricCount,
  options: MetricOptions = {},
): MetricWidget {
  if (typeof source === "function") {
    return { kind: "metric", label, query: source, options: { format: "number", ...options } };
  }
  const counted = countSource(source, options);
  const scope = (ctx: WidgetContext) =>
    typeof counted.where === "function" ? counted.where(ctx) : (counted.where ?? {});
  const range = counted.range === undefined ? {} : { range: counted.range };
  return {
    kind: "metric",
    label,
    query: (ctx) => ctx.count(counted.resource, scope(ctx), range),
    options: {
      format: "number",
      drilldown: (ctx) => {
        const filter = scope(ctx);
        const missing = Object.values(filter).some(
          (value) => value === undefined || value === null || value === "",
        );
        if (missing) return null;
        const field = counted.range;
        const bound = field === undefined ? undefined : whereValue(filter[field]);
        if (field === undefined || !isFilterRangeValue(bound)) {
          return { resource: counted.resource, filter, ...range };
        }
        const overlap = withRange("metric", { ...filter, [field]: bound }, field, ctx.dateRange, [
          field,
        ]);
        return { resource: counted.resource, filter: overlap };
      },
      ...options,
    },
    source: counted,
  };
}

/** A list-of-rows widget on a dashboard. */
export function table<R = unknown>(options: TableWidgetOptions<R>): TableWidget {
  return { kind: "table", options: options as TableWidgetOptions };
}

/** Drop a fully-custom React component into a dashboard section. */
export function custom<P>(
  Component: ComponentType<P>,
  props: P | ((ctx: WidgetContext) => Promise<P>),
  options: CustomOptions = {},
): CustomWidget {
  return { kind: "custom", Component: Component as ComponentType<unknown>, props, options };
}

/** A row of small stats (count + label) — denser than a grid of `metric()` cards. */
export function statGroup(options: StatGroupOptions): StatGroupWidget {
  return { kind: "statGroup", options };
}

/** One number and a label. A `metric()` without the delta and sparkline machinery. */
export function stat(
  label: string,
  value: StatWidget["value"],
  options: StatOptions = {},
): StatWidget {
  return { kind: "stat", label, value, options };
}

/** A label/value card — the facts about one thing rather than a table of many. */
export function kv<R extends object = Record<string, unknown>>(options: KvOptions<R>): KvWidget {
  return { kind: "kv", options: options as unknown as KvOptions };
}

/** A ranked breakdown, sized against the largest value. */
export function bars(options: BarsOptions): BarsWidget {
  return { kind: "bars", options };
}

/** Stages with their share of the first step and the drop-off from the one before. */
export function funnel(options: FunnelOptions): FunnelWidget {
  return { kind: "funnel", options };
}

/** A short feed of lines, each with optional trailing detail. */
export function list(options: ListOptions): ListWidget {
  return { kind: "list", options };
}

/** "Anything on fire": a full-width `list()` ordered by severity, with an all-clear line. */
export function banner(options: Omit<ListOptions, "variant">): ListWidget {
  return { kind: "list", options: { span: 12, ...options, variant: "banner" } };
}

/** Status over time: one row per key, one block per hour or day of a window ending now. */
export function tracker<R = Record<string, unknown>>(options: TrackerOptions<R>): TrackerWidget {
  return { kind: "tracker", options: options as unknown as TrackerOptions };
}
