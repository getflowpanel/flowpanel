"use client";
import { useLabels } from "@flowpanel/react";

/** A chart whose query returned no rows: one line where the plot would start. */
export function ChartEmptyState() {
  const labels = useLabels();
  return <p className="px-1 text-sm text-fp-text-2">{labels.widget.empty}</p>;
}
