"use client";
import { FilterBar, type FilterBarSpec } from "@flowpanel/react";
import * as React from "react";
import { type ListHistory, useListNavigation } from "./list-navigation";

/** Filters typed key by key: one history entry per burst of typing, not one per keystroke. */
const TYPED = new Set<FilterBarSpec["type"]>(["text", "numeric-range", "tag"]);
const BURST_MS = 1000;

export interface ResourceListFilterSpec extends FilterBarSpec {
  defaultValue?: string;
  hidden?: boolean;
}

export interface ResourceListFiltersProps {
  filters: ResourceListFilterSpec[];
}

export function ResourceListFilters({ filters }: ResourceListFiltersProps) {
  const { navigate: go, params } = useListNavigation();
  const typing = React.useRef<{ field: string; at: number } | null>(null);
  const shown = filters.filter((f) => !f.hidden);
  if (shown.length === 0) return null;

  const hidden = new Set(filters.filter((f) => f.hidden).map((f) => f.field));
  const defaulted = new Set(shown.filter((f) => f.defaultValue !== undefined).map((f) => f.field));
  const values: Record<string, string> = {};
  for (const [key, value] of params) {
    const field = key.slice(2);
    if (key.startsWith("f_") && value !== "" && !hidden.has(field)) values[field] = value;
  }
  for (const f of shown) {
    if (f.defaultValue !== undefined && !params.has(`f_${f.field}`))
      values[f.field] = f.defaultValue;
  }

  const types = new Map(shown.map((f) => [f.field, f.type]));
  const navigate = (mutate: (next: URLSearchParams) => void, history: ListHistory) =>
    go((next) => {
      mutate(next);
      next.delete("page");
    }, history);
  const historyFor = (field: string): ListHistory => {
    const type = types.get(field);
    if (!type || !TYPED.has(type)) {
      typing.current = null;
      return "push";
    }
    const now = Date.now();
    const last = typing.current;
    typing.current = { field, at: now };
    return last && last.field === field && now - last.at < BURST_MS ? "replace" : "push";
  };
  const setFilter = (field: string, value: string | null) =>
    navigate((next) => {
      if (value) next.set(`f_${field}`, value);
      else if (defaulted.has(field)) next.set(`f_${field}`, "");
      else next.delete(`f_${field}`);
    }, historyFor(field));
  const clear = () =>
    navigate((next) => {
      for (const key of [...next.keys()]) if (key.startsWith("f_")) next.delete(key);
      for (const field of defaulted) next.set(`f_${field}`, "");
    }, "push");

  // No margin: the parent `items-center` row owns the spacing.
  return <FilterBar filters={shown} values={values} onChange={setFilter} onClear={clear} />;
}
