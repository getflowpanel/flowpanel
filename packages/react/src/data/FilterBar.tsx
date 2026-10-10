"use client";
import type { FilterType } from "@flowpanel/core";
import { cn } from "../lib/cn";
import { humanize } from "../lib/humanize";
import { useLabels } from "../provider/LabelsContext";
import { BooleanFilter } from "./filters/BooleanFilter";
import { DateRangeFilter } from "./filters/DateRangeFilter";
import { MultiSelectFilter } from "./filters/MultiSelectFilter";
import { NumericRangeFilter } from "./filters/NumericRangeFilter";
import { SelectFilter } from "./filters/SelectFilter";
import { TagFilter } from "./filters/TagFilter";
import { TextFilter } from "./filters/TextFilter";

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
  const labels = useLabels();
  const hasAny = Object.keys(values).length > 0;
  return (
    <div
      className={cn("fp-flex fp-flex-wrap fp-items-center fp-gap-2", className)}
      role="toolbar"
      aria-label={labels.filters.label}
    >
      {filters.map((f) => {
        const v = values[f.field] ?? null;
        const common = {
          value: v,
          onChange: (nv: string | null) => onChange(f.field, nv),
          label: f.label ?? humanize(f.field),
          ...(f.placeholder !== undefined ? { placeholder: f.placeholder } : {}),
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
          default:
            return null;
        }
      })}
      {hasAny && onClear ? (
        // A text link, not a button: resetting is a quiet escape hatch, not competing for attention.
        <button
          type="button"
          onClick={onClear}
          className="fp-press fp-ml-1 fp-rounded-sm fp-px-1 fp-text-sm fp-text-soft fp-underline fp-underline-offset-4 fp-transition-colors hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
        >
          {labels.filters.clear}
        </button>
      ) : null}
    </div>
  );
}
