"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext.js";
import { DefaultMetricCard } from "./MetricCardDefault.js";

export { DefaultMetricCard, type MetricCardProps } from "./MetricCardDefault.js";

/** falling back to DefaultMetricCard. */
export function MetricCard(
  props: import("./MetricCardDefault.js").MetricCardProps,
): React.JSX.Element {
  const Slot = useComponent("MetricCard", DefaultMetricCard);
  return <Slot {...props} />;
}
