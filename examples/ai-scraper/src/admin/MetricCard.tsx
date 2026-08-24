"use client";
import { DefaultMetricCard, type MetricCardProps } from "@flowpanel/kit/react";

/** Small theme override that keeps the standard Flowpanel metric body. */
export function MetricCard(props: MetricCardProps) {
  return (
    <div className="rounded-fp-lg transition-shadow duration-200 hover:shadow-fp-md">
      <DefaultMetricCard {...props} />
    </div>
  );
}
