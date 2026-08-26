"use client";
import * as React from "react";
import { cn } from "../../lib/cn";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { BARE_CONTROL, FilterField } from "./FilterField";

export interface BooleanFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  trueLabel?: string;
  falseLabel?: string;
}

const ALL = "__all__";

export function BooleanFilter({
  label,
  value,
  onChange,
  trueLabel = "Yes",
  falseLabel = "No",
}: BooleanFilterProps) {
  const id = React.useId();
  return (
    <FilterField label={label} htmlFor={id} active={Boolean(value)}>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger id={id} className={cn(BARE_CONTROL, "w-auto justify-start")}>
          <SelectValue placeholder="Any" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any</SelectItem>
          <SelectItem value="true">{trueLabel}</SelectItem>
          <SelectItem value="false">{falseLabel}</SelectItem>
        </SelectContent>
      </Select>
    </FilterField>
  );
}
