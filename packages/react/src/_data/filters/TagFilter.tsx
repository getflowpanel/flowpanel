"use client";
import * as React from "react";
import { cn } from "../../lib/cn.js";
import { Input } from "../../ui/input.js";
import { BARE_CONTROL, FilterField } from "./FilterField.js";

export interface TagFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export function TagFilter({ label, value, onChange, placeholder = "tag1, tag2" }: TagFilterProps) {
  const id = React.useId();
  const [local, setLocal] = React.useState(value ?? "");
  React.useEffect(() => setLocal(value ?? ""), [value]);
  return (
    <FilterField label={label} htmlFor={id} active={Boolean(value)}>
      <Input
        id={id}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local.trim() === "" ? null : local.trim())}
        placeholder={placeholder}
        className={cn(BARE_CONTROL, "w-40")}
      />
    </FilterField>
  );
}
