"use client";
import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select.js";

export interface BooleanFilterProps {
  field: string;
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
    <label htmlFor={id} className="flex flex-col gap-1">
      {label ? <span className="text-xs text-fp-text-3">{label}</span> : null}
      <Select value={value ?? ALL} onValueChange={(v) => onChange(v === ALL ? null : v)}>
        <SelectTrigger id={id} className="h-8 w-28">
          <SelectValue placeholder="Any" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any</SelectItem>
          <SelectItem value="true">{trueLabel}</SelectItem>
          <SelectItem value="false">{falseLabel}</SelectItem>
        </SelectContent>
      </Select>
    </label>
  );
}
