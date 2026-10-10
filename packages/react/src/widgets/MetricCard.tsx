"use client";
import type * as React from "react";
import { useComponent } from "../provider/ComponentsContext";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { DefaultMetricCard } from "./MetricCardDefault";

export { DefaultMetricCard, type MetricCardProps } from "./MetricCardDefault";

export function MetricCard(
  props: import("./MetricCardDefault").MetricCardProps,
): React.JSX.Element {
  const Slot = useComponent("MetricCard", DefaultMetricCard);
  const formatting = useFormatting();
  const { widget } = useLabels();
  return (
    <Slot
      formatting={formatting}
      previousLabel={widget.previous}
      pointsLabel={widget.points}
      noChangeLabel={widget.noChange}
      trendLabel={widget.trend}
      {...props}
    />
  );
}
