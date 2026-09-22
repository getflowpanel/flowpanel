import type { ComponentType } from "react";
import type {
  CustomOptions,
  CustomWidget,
  MetricOptions,
  MetricResult,
  MetricWidget,
  TableWidget,
  TableWidgetOptions,
  WidgetContext,
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

/** A single big-number widget. */
export function metric(
  label: string,
  query: (ctx: WidgetContext) => Promise<number | string | MetricResult>,
  options: MetricOptions = {},
): MetricWidget {
  return {
    kind: "metric",
    label,
    query,
    options: { format: "number", ...options },
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
export function kv(options: KvOptions): KvWidget {
  return { kind: "kv", options };
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
