"use client";
import * as React from "react";
import { cn } from "../../lib/cn";
import { useLatest } from "../../lib/use-latest";
import { useLabels } from "../../provider/LabelsContext";
import { Input } from "../../ui/input";
import { BARE_CONTROL, FilterField } from "./FilterField";

export interface TextFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function TextFilter({
  label,
  value,
  onChange,
  placeholder,
  debounceMs = 300,
}: TextFilterProps) {
  const labels = useLabels();
  const id = React.useId();
  const [local, setLocal] = React.useState(value ?? "");
  // A value from outside shows in this render and is never echoed back as a change.
  const [seen, setSeen] = React.useState(value);
  if (seen !== value) {
    setSeen(value);
    setLocal(value ?? "");
  }
  const onChangeRef = useLatest(onChange);
  React.useEffect(() => {
    if (local === (seen ?? "")) return;
    const t = setTimeout(() => onChangeRef.current(local === "" ? null : local), debounceMs);
    return () => clearTimeout(t);
  }, [local, seen, debounceMs, onChangeRef]);
  return (
    <FilterField label={label} htmlFor={id} active={Boolean(value)}>
      <Input
        id={id}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder ?? labels.filters.searchPlaceholder}
        className={cn(BARE_CONTROL, "fp-w-36")}
      />
    </FilterField>
  );
}
