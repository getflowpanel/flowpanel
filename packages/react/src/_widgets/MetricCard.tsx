"use client";
import type * as React from "react";
import { useComponent } from "../_provider/ComponentsContext";
import { useFormatting } from "../_provider/FormattingContext";
import { DefaultMetricCard } from "./MetricCardDefault";

export { DefaultMetricCard, type MetricCardProps } from "./MetricCardDefault";

export function MetricCard(
  props: import("./MetricCardDefault").MetricCardProps,
): React.JSX.Element {
  const Slot = useComponent("MetricCard", DefaultMetricCard);
  const formatting = useFormatting();
  return <Slot formatting={formatting} {...props} />;
}
