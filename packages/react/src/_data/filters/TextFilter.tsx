"use client";
import * as React from "react";
import { Input } from "../../ui/input.js";

export interface TextFilterProps {
  field: string;
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
  const [local, setLocal] = React.useState(value ?? "");
  React.useEffect(() => setLocal(value ?? ""), [value]);
  const committed = React.useRef(value ?? "");
  React.useEffect(() => {
    const t = setTimeout(() => {
      if (local !== committed.current) {
        committed.current = local;
        onChange(local === "" ? null : local);
      }
    }, debounceMs);
    return () => clearTimeout(t);
    // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — local triggers
  }, [local]);
  return (
    <label className="flex flex-col gap-1">
      {label ? <span className="text-xs text-fp-text-3">{label}</span> : null}
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder ?? "Search…"}
        className="h-8 w-40"
      />
    </label>
  );
}
