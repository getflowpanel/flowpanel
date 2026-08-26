"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { DefaultMetricCard } from "./MetricCardDefault";

export { DefaultMetricCard, type MetricCardProps } from "./MetricCardDefault";

/** falling back to DefaultMetricCard. */
export function MetricCard(
  props: import("./MetricCardDefault").MetricCardProps,
): React.JSX.Element {
  const Slot = useComponent("MetricCard", DefaultMetricCard);
  return <Slot {...props} />;
}
