"use client";
import type { FilterType } from "@flowpanel/core";
import { Button } from "../ui/button.js";
import { BooleanFilter } from "./filters/BooleanFilter.js";
import { DateRangeFilter } from "./filters/DateRangeFilter.js";
import { MultiSelectFilter } from "./filters/MultiSelectFilter.js";
import { NumericRangeFilter } from "./filters/NumericRangeFilter.js";
import { SelectFilter } from "./filters/SelectFilter.js";
import { TagFilter } from "./filters/TagFilter.js";
import { TextFilter } from "./filters/TextFilter.js";

export interface FilterBarSpec {
  field: string;
  type: FilterType;
  label?: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export interface FilterBarProps {
  filters: FilterBarSpec[];
  values: Record<string, string>;
  onChange: (field: string, value: string | null) => void;
  onClear?: () => void;
  className?: string;
}

export function FilterBar({ filters, values, onChange, onClear, className }: FilterBarProps) {
  const hasAny = Object.keys(values).length > 0;
  return (
    <div
      className={`flex flex-wrap items-end gap-3 ${className ?? ""}`}
      role="group"
      aria-label="Filters"
    >
      {filters.map((f) => {
        const v = values[f.field] ?? null;
        const common = {
          field: f.field,
          value: v,
          onChange: (nv: string | null) => onChange(f.field, nv),
          ...(f.label ? { label: f.label } : {}),
          ...(f.placeholder ? { placeholder: f.placeholder } : {}),
        } as const;
        switch (f.type) {
          case "text":
            return <TextFilter key={f.field} {...common} />;
          case "select":
            return <SelectFilter key={f.field} {...common} options={f.options ?? []} />;
          case "multiselect":
            return <MultiSelectFilter key={f.field} {...common} options={f.options ?? []} />;
          case "daterange":
            return <DateRangeFilter key={f.field} {...common} />;
          case "numeric-range":
            return <NumericRangeFilter key={f.field} {...common} />;
          case "boolean":
            return <BooleanFilter key={f.field} {...common} />;
          case "tag":
            return <TagFilter key={f.field} {...common} />;
        }
      })}
      {hasAny && onClear ? (
        <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear filters">
          Clear
        </Button>
      ) : null}
    </div>
  );
}
