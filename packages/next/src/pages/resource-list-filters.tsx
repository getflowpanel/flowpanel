"use client";
import { FilterBar, type FilterBarSpec } from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface ResourceListFilterSpec extends FilterBarSpec {
  defaultValue?: string;
  hidden?: boolean;
}

export interface ResourceListFiltersProps {
  filters: ResourceListFilterSpec[];
}

export function ResourceListFilters({ filters }: ResourceListFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
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

  const navigate = (mutate: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    mutate(next);
    next.delete("page");
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const setFilter = (field: string, value: string | null) =>
    navigate((next) => {
      if (value) next.set(`f_${field}`, value);
      else if (defaulted.has(field)) next.set(`f_${field}`, "");
      else next.delete(`f_${field}`);
    });
  const clear = () =>
    navigate((next) => {
      for (const key of [...next.keys()]) if (key.startsWith("f_")) next.delete(key);
      for (const field of defaulted) next.set(`f_${field}`, "");
    });

  // No margin: the parent `items-center` row owns the spacing.
  return <FilterBar filters={shown} values={values} onChange={setFilter} onClear={clear} />;
}
