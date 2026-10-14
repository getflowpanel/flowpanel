"use client";
import { formatCount } from "@flowpanel/core/labels";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";
import { useFormatting } from "../../provider/FormattingContext";
import { useLabels } from "../../provider/LabelsContext";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import { BARE_CONTROL, FilterField } from "./FilterField";

export interface MultiSelectFilterOption {
  label: string;
  value: string;
}

export interface MultiSelectFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: MultiSelectFilterOption[];
  placeholder?: string;
}

export function MultiSelectFilter({
  label,
  value,
  onChange,
  options,
  placeholder: override,
}: MultiSelectFilterProps) {
  const labels = useLabels();
  const { locale } = useFormatting();
  const placeholder = override ?? labels.filters.allOption;
  const id = React.useId();
  const selected = React.useMemo(() => (value ? value.split(",").filter(Boolean) : []), [value]);
  const toggle = (v: string) => {
    const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
    onChange(next.length === 0 ? null : next.join(","));
  };
  const buttonText =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : formatCount(labels.plurals?.selected ?? labels.bulkBar.selected, selected.length, locale);
  return (
    <FilterField label={label} active={selected.length > 0}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              BARE_CONTROL,
              "fp-w-auto fp-justify-start fp-font-normal",
              selected.length === 0 && "fp-text-soft",
            )}
          >
            <span className="fp-truncate">{buttonText}</span>
            <ChevronDown aria-hidden className="fp-h-4 fp-w-4 fp-shrink-0 fp-opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="fp-w-48 fp-p-1">
          {options.map((o) => (
            <label
              key={o.value}
              htmlFor={`${id}-${o.value}`}
              className="fp-flex fp-cursor-pointer fp-items-center fp-gap-2 fp-rounded-sm fp-px-2 fp-py-1.5 fp-transition-colors hover:fp-bg-fill/70"
            >
              <Checkbox
                id={`${id}-${o.value}`}
                checked={selected.includes(o.value)}
                onCheckedChange={() => toggle(o.value)}
              />
              <span className="fp-text-sm">{o.label}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}
