"use client";
import * as React from "react";
import { AsyncSelect } from "../_forms/AsyncSelect";
import { useLabels } from "../_provider/LabelsContext";

export interface ReferenceItem {
  id: string;
  label: string;
}

export interface ReferencePickerProps {
  value: string | null;
  onChange: (id: string | null) => void;
  search: (query: string) => Promise<ReferenceItem[]>;
  placeholder?: string;
  emptyText?: string | undefined;
  debounceMs?: number;
  className?: string;
}

/** Row-reference picker: `AsyncSelect` addressed by row id rather than option value. */
export function ReferencePicker({
  value,
  onChange,
  search,
  placeholder = "Search…",
  emptyText,
  debounceMs = 200,
  className,
}: ReferencePickerProps) {
  const labels = useLabels();
  const loadOptions = React.useCallback(
    async (query: string) =>
      (await search(query)).map((item) => ({ value: item.id, label: item.label })),
    [search],
  );
  return (
    <AsyncSelect
      value={value}
      onChange={onChange}
      loadOptions={loadOptions}
      placeholder={placeholder}
      emptyText={emptyText ?? labels.noResults}
      debounceMs={debounceMs}
      {...(className ? { className } : {})}
    />
  );
}
