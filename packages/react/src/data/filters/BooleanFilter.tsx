"use client";
import * as React from "react";
import { cn } from "../../lib/cn";
import { useLabels } from "../../provider/LabelsContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { BARE_CONTROL, FilterField } from "./FilterField";

export interface BooleanFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  trueLabel?: string;
  falseLabel?: string;
  placeholder?: string;
}

const ALL = "__all__";

export function BooleanFilter({
  label,
  value,
  onChange,
  trueLabel,
  falseLabel,
  placeholder,
}: BooleanFilterProps) {
  const labels = useLabels();
  const allOption = placeholder ?? labels.filters.allOption;
  const id = React.useId();
  return (
    <FilterField label={label} htmlFor={id} active={Boolean(value)}>
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger id={id} className={cn(BARE_CONTROL, "fp-w-auto fp-justify-start")}>
          <SelectValue placeholder={allOption} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allOption}</SelectItem>
          <SelectItem value="true">{trueLabel ?? labels.filters.yes}</SelectItem>
          <SelectItem value="false">{falseLabel ?? labels.filters.no}</SelectItem>
        </SelectContent>
      </Select>
    </FilterField>
  );
}
