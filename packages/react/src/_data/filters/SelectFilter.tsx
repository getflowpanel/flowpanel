"use client";
import * as React from "react";
import { cn } from "../../lib/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { BARE_CONTROL, FilterField } from "./FilterField";

export interface SelectFilterOption {
  label: string;
  value: string;
}

export interface SelectFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: SelectFilterOption[];
  placeholder?: string;
}

const ALL = "__all__";

export function SelectFilter({
  label,
  value,
  onChange,
  options,
  placeholder = "All",
}: SelectFilterProps) {
  const id = React.useId();
  return (
    <FilterField label={label} htmlFor={id} active={Boolean(value)}>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger id={id} className={cn(BARE_CONTROL, "w-auto justify-start")}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{placeholder}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  );
}
