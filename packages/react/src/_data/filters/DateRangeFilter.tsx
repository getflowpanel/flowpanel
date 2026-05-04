"use client";
import { Input } from "../../ui/input.js";

export interface DateRangeFilterProps {
  field: string;
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

export function DateRangeFilter({ label, value, onChange }: DateRangeFilterProps) {
  const [from, to] = (value ?? ":").split(":");
  const emit = (nextFrom: string, nextTo: string) => {
    const combined = `${nextFrom}:${nextTo}`;
    onChange(combined === ":" ? null : combined);
  };
  return (
    <div className="flex flex-col gap-1">
      {label ? <span className="text-xs text-fp-text-3">{label}</span> : null}
      <div className="flex items-center gap-1">
        <Input
          type="date"
          value={from ?? ""}
          onChange={(e) => emit(e.target.value, to ?? "")}
          className="h-8 w-[140px]"
          aria-label="From"
        />
        <span className="text-fp-text-3">—</span>
        <Input
          type="date"
          value={to ?? ""}
          onChange={(e) => emit(from ?? "", e.target.value)}
          className="h-8 w-[140px]"
          aria-label="To"
        />
      </div>
    </div>
  );
}
