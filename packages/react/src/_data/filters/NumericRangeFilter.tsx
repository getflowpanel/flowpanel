"use client";
import { cn } from "../../lib/cn.js";
import { Input } from "../../ui/input.js";
import { BARE_CONTROL, FilterField } from "./FilterField.js";

export interface NumericRangeFilterProps {
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
    <FilterField label={label} active={Boolean(value)}>
      <Input
        type="number"
        value={min ?? ""}
        step={step}
        onChange={(e) => emit(e.target.value, max ?? "")}
        className={cn(BARE_CONTROL, "w-16")}
        aria-label="Min"
        placeholder="min"
      />
      <span aria-hidden className="px-0.5 text-fp-text-3">
        –
      </span>
      <Input
        type="number"
        value={max ?? ""}
        step={step}
        onChange={(e) => emit(min ?? "", e.target.value)}
        className={cn(BARE_CONTROL, "w-16")}
        aria-label="Max"
        placeholder="max"
      />
    </FilterField>
  );
}
