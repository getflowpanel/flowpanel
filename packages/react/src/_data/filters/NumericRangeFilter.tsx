"use client";
import { Input } from "../../ui/input.js";

export interface NumericRangeFilterProps {
  field: string;
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  step?: number;
}

export function NumericRangeFilter({ label, value, onChange, step }: NumericRangeFilterProps) {
  const [min, max] = (value ?? ":").split(":");
  const emit = (nextMin: string, nextMax: string) => {
    const combined = `${nextMin}:${nextMax}`;
    onChange(combined === ":" ? null : combined);
  };
  return (
    <div className="flex flex-col gap-1">
      {label ? <span className="text-xs text-fp-text-3">{label}</span> : null}
      <div className="flex items-center gap-1">
        <Input
          type="number"
          value={min ?? ""}
          step={step}
          onChange={(e) => emit(e.target.value, max ?? "")}
          className="h-8 w-24"
          aria-label="Min"
          placeholder="min"
        />
        <span className="text-fp-text-3">—</span>
        <Input
          type="number"
          value={max ?? ""}
          step={step}
          onChange={(e) => emit(min ?? "", e.target.value)}
          className="h-8 w-24"
          aria-label="Max"
          placeholder="max"
        />
      </div>
    </div>
  );
}
