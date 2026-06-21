"use client";
import { DefaultMetricCard, type MetricCardProps } from "@flowpanel/kit/react";

/**
 * Showcase override for FlowPanel's MetricCard slot.
 *
 * Demonstrates the L2 customization tier from spec §8: a small wrapper that
 * enhances the default body without reimplementing the metric rendering. Here
 * it adds a subtle hover elevation — a clean accent, not a second border.
 *
 * Wired into the admin via `theme.components.MetricCard` in
 * `src/admin/config`.
 */
export function PriorityMetricCard(props: MetricCardProps) {
  return (
    <div className="rounded-fp transition-shadow duration-200 hover:shadow-lg hover:shadow-black/20">
      <DefaultMetricCard {...props} />
    </div>
  );
}
