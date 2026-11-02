"use client";
import { useLabels } from "@flowpanel/react";

/** A chart whose query returned no rows: one line where the plot would start. */
export function ChartEmptyState() {
  const labels = useLabels();
  return <p className="fp-px-1 fp-text-sm fp-text-soft">{labels.widget.empty}</p>;
}
