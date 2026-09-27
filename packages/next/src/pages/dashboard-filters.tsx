"use client";
import { SelectFilter, useLabels } from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DashboardFilterView } from "../runtime/dashboard-filters";
import { dropTimelinePages } from "../runtime/timeline-pages";

export interface DashboardFiltersProps {
  filters: DashboardFilterView[];
}

/** The query string with each `f_<key>` set, or removed for `null`. */
export function filterQuery(search: string, changes: Record<string, string | null>): string {
  const params = new URLSearchParams(search);
  dropTimelinePages(params);
  for (const [key, value] of Object.entries(changes)) {
    if (value === null) params.delete(`f_${key}`);
    else params.set(`f_${key}`, value);
  }
  return params.toString();
}

/** One select per dashboard filter beside the date picker, and a clear button once any is set. */
export function DashboardFilters({ filters }: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const words = useLabels();
  if (filters.length === 0) return null;
  const go = (changes: Record<string, string | null>) => {
    const query = filterQuery(searchParams?.toString() ?? "", changes);
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <SelectFilter
          key={filter.key}
          label={filter.label}
          value={filter.value}
          options={filter.options}
          onChange={(value) => go({ [filter.key]: value })}
        />
      ))}
      {filters.some((filter) => filter.value !== null) ? (
        <button
          type="button"
          onClick={() => go(Object.fromEntries(filters.map((filter) => [filter.key, null])))}
          className="inline-flex min-h-11 items-center rounded-fp-sm px-2 text-xs text-fp-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 sm:min-h-6"
        >
          {words.filters.clear}
        </button>
      ) : null}
    </div>
  );
}
