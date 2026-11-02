"use client";
import { formatLabel } from "@flowpanel/core/labels";
import { useLabels } from "../provider/LabelsContext";
import { Button } from "../ui/button";

export type DataTableDensity = "comfortable" | "compact";

export interface DensityToggleProps {
  density: DataTableDensity;
  onChange: (density: DataTableDensity) => void;
}

export function DensityToggle({ density, onChange }: DensityToggleProps) {
  const next: DataTableDensity = density === "compact" ? "comfortable" : "compact";
  const { table } = useLabels();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange(next)}
      aria-label={formatLabel(table.density, { current: table[density], next: table[next] })}
    >
      {table[density]}
    </Button>
  );
}
