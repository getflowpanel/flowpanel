"use client";
import { DefaultMetricCard, type MetricCardProps } from "@flowpanel/kit/react";

/** Wraps, rather than reimplements, the default body — wired via
 *  `theme.components.MetricCard` in `src/admin/config`. */
export function PriorityMetricCard(props: MetricCardProps) {
  return (
    <div className="rounded-fp-lg transition-shadow duration-200 hover:shadow-fp-md">
      <DefaultMetricCard {...props} />
    </div>
  );
}
