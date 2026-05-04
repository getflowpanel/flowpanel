"use client";
import * as React from "react";
import { Button } from "../../ui/button.js";
import { Checkbox } from "../../ui/checkbox.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover.js";

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
    <div className="flex flex-col gap-1">
      {label ? <span className="text-xs text-fp-text-3">{label}</span> : null}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-40 justify-between">
            {buttonText}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-1">
          {options.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-fp-bg-2"
            >
              <Checkbox
                checked={selected.includes(o.value)}
                onCheckedChange={() => toggle(o.value)}
              />
              <span className="text-sm">{o.label}</span>
            </label>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
