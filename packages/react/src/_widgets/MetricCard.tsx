"use client";
import type * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";

export { DefaultMetricCard, type MetricCardProps } from "./MetricCardDefault.js";

/** falling back to DefaultMetricCard. */
export function MetricCard(
  props: import("./MetricCardDefault.js").MetricCardProps,
): React.JSX.Element {
  const Slot = useComponents().MetricCard;
  return <Slot {...props} />;
}
