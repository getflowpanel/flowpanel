"use client";
import { Button } from "../ui/button.js";

export type DataTableDensity = "comfortable" | "compact";

export interface DensityToggleProps {
  density: DataTableDensity;
  onChange: (density: DataTableDensity) => void;
}

export function DensityToggle({ density, onChange }: DensityToggleProps) {
  const next: DataTableDensity = density === "compact" ? "comfortable" : "compact";
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onChange(next)}
      aria-label={`Density: ${density}. Click to switch to ${next}.`}
    >
      {density === "compact" ? "Compact" : "Comfortable"}
    </Button>
  );
}
