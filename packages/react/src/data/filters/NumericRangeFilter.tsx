"use client";
import { cn } from "../../lib/cn";
import { useLabels } from "../../provider/LabelsContext";
import { Input } from "../../ui/input";
import { BARE_CONTROL, FilterField } from "./FilterField";

export interface NumericRangeFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  step?: number;
}

export function NumericRangeFilter({ label, value, onChange, step }: NumericRangeFilterProps) {
  const [min, max] = (value ?? ":").split(":");
  const { filters } = useLabels();
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
        className={cn(BARE_CONTROL, "fp-w-16")}
        aria-label={filters.min}
        placeholder={filters.min}
      />
      <span aria-hidden className="fp-px-0.5 fp-text-faint">
        –
      </span>
      <Input
        type="number"
        value={max ?? ""}
        step={step}
        onChange={(e) => emit(min ?? "", e.target.value)}
        className={cn(BARE_CONTROL, "fp-w-16")}
        aria-label={filters.max}
        placeholder={filters.max}
      />
    </FilterField>
  );
}
