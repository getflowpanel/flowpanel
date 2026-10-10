"use client";
import * as React from "react";
import { cn } from "../../lib/cn";
import { useLabels } from "../../provider/LabelsContext";
import { Input } from "../../ui/input";
import { BARE_CONTROL, FilterField } from "./FilterField";

export interface TagFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export function TagFilter({ label, value, onChange, placeholder }: TagFilterProps) {
  const { filters } = useLabels();
  const id = React.useId();
  const [local, setLocal] = React.useState(value ?? "");
  const [seen, setSeen] = React.useState(value);
  if (seen !== value) {
    setSeen(value);
    setLocal(value ?? "");
  }
  return (
    <FilterField label={label} htmlFor={id} active={Boolean(value)}>
      <Input
        id={id}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local.trim() === "" ? null : local.trim())}
        placeholder={placeholder ?? filters.tagsPlaceholder}
        className={cn(BARE_CONTROL, "fp-w-40")}
      />
    </FilterField>
  );
}
