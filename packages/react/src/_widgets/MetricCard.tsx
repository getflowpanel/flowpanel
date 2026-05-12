"use client";
import * as React from "react";
import { useComponents } from "../_provider/ComponentsContext.js";
export { DefaultMetricCard, type MetricCardProps } from "./MetricCardDefault.js";

/** Renders whatever override the user registered via theme.components.MetricCard,
 *  falling back to DefaultMetricCard. Use this internally; users keep importing
 *  { MetricCard } as the public name. */
export function MetricCard(
  props: import("./MetricCardDefault.js").MetricCardProps,
): React.JSX.Element {
  const Slot = useComponents().MetricCard;
  return <Slot {...props} />;
}
