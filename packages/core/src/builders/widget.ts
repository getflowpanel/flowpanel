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

export function table(options: TableWidgetOptions): TableWidget {
  return { kind: "table", options };
}

export function custom<P>(
  Component: ComponentType<P>,
  props: P | ((ctx: WidgetContext) => Promise<P>),
  options: CustomOptions = {},
): CustomWidget<P> {
  return { kind: "custom", Component, props, options };
}

export function statGroup(options: StatGroupOptions): StatGroupWidget {
  return { kind: "statGroup", options };
}
