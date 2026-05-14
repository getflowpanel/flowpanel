"use client";
import { DefaultMetricCard, type MetricCardProps } from "flowpanel/react";

/**
 * Showcase override for FlowPanel's MetricCard slot.
 *
 * Demonstrates the L2 customization tier from spec §8: a small wrapper
 * that adds visual ornamentation around the default body without
 * reimplementing the metric rendering itself.
 *
 * Wired into the admin via `theme.components.MetricCard` in
 * `flowpanel.config.ts`.
 */
export function PriorityMetricCard(props: MetricCardProps) {
  return (
    <div className="rounded-fp ring-1 ring-amber-500/40 p-0.5">
      <DefaultMetricCard {...props} />
    </div>
  );
}
