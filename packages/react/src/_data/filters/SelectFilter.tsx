"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";

export interface SelectFilterOption {
  label: string;
  value: string;
}

export interface SelectFilterProps {
  field: string;
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
  return (
    <label className="flex flex-col gap-1">
      {label ? <span className="text-xs text-fp-text-3">{label}</span> : null}
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger className="h-8 w-40">
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
    </label>
  );
}
