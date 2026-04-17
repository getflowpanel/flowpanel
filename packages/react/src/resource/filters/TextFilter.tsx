import { useEffect, useRef, useState } from "react";
import type { SerializedFilter } from "@flowpanel/core";
import { Input } from "../../ui/input";

export function TextFilter({
  filter,
  value,
  onChange,
}: {
  filter: SerializedFilter;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [local, setLocal] = useState(value === undefined ? "" : String(value));
  const debounceMs = filter.opts?.debounceMs ?? 300;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onChange(local === "" ? undefined : local);
    }, debounceMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [local, debounceMs, onChange]);

  // Sync external value changes
  useEffect(() => {
    setLocal(value === undefined || value === null ? "" : String(value));
  }, [value]);

  return (
    <Input
      className="h-8 text-sm"
      placeholder={filter.label}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
    />
  );
}
