"use client";
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn.js";
import { Button } from "../../ui/button.js";
import { Checkbox } from "../../ui/checkbox.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";
import { BARE_CONTROL, FilterField } from "./FilterField.js";

export interface MultiSelectFilterOption {
  label: string;
  value: string;
}

export interface MultiSelectFilterProps {
  field: string;
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
  placeholder = "Any",
}: MultiSelectFilterProps) {
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
        : `${selected.length} selected`;
  return (
    <FilterField label={label} active={selected.length > 0}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              BARE_CONTROL,
              "w-auto justify-start font-normal",
              selected.length === 0 && "text-fp-text-2",
            )}
          >
            <span className="truncate">{buttonText}</span>
            <ChevronDown aria-hidden className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1">
          {options.map((o) => (
            <label
              key={o.value}
              htmlFor={`${id}-${o.value}`}
              className="flex cursor-pointer items-center gap-2 rounded-fp-sm px-2 py-1.5 transition-colors hover:bg-fp-bg-3/70"
            >
              <Checkbox
                id={`${id}-${o.value}`}
                checked={selected.includes(o.value)}
                onCheckedChange={() => toggle(o.value)}
              />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}
