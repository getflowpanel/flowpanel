"use client";
import * as React from "react";
import { Input } from "../../ui/input.js";

export interface TagFilterProps {
  field: string;
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

export function TagFilter({ label, value, onChange, placeholder = "tag1, tag2" }: TagFilterProps) {
  const [local, setLocal] = React.useState(value ?? "");
  React.useEffect(() => setLocal(value ?? ""), [value]);
  return (
    <label className="flex flex-col gap-1">
      {label ? <span className="text-xs text-fp-text-3">{label}</span> : null}
      <Input
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(local.trim() === "" ? null : local.trim())}
        placeholder={placeholder}
        className="h-8 w-48"
      />
    </label>
  );
}
