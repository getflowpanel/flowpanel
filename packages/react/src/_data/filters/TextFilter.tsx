"use client";
import * as React from "react";
import { cn } from "../../lib/cn.js";
import { Input } from "../../ui/input.js";
import { BARE_CONTROL, FilterField } from "./FilterField.js";

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
  const id = React.useId();
  const [local, setLocal] = React.useState(value ?? "");
  const committed = React.useRef(value ?? "");
  // A value arriving from outside (clear-filters, a restored view) is already
  // committed; without this the debounce would echo it back as a change.
  React.useEffect(() => {
    setLocal(value ?? "");
    committed.current = value ?? "";
  }, [value]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — only `local` should re-arm the debounce; onChange/debounceMs are read fresh inside the timer.
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (local !== committed.current) {
        committed.current = local;
        onChange(local === "" ? null : local);
      }
    }, debounceMs);
    return () => clearTimeout(t);
  }, [local]);
  return (
    <FilterField label={label} htmlFor={id} active={Boolean(value)}>
      <Input
        id={id}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        className={cn(BARE_CONTROL, "w-36")}
      />
    </FilterField>
  );
}
