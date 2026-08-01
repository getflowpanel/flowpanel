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

/** A single big-number widget. */
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
