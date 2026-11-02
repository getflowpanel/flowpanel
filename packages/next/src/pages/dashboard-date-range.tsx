"use client";
import type { DateRangePreset } from "@flowpanel/core";
import { DateRangePicker } from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { dropTimelinePages } from "../runtime/timeline-pages";

export interface DashboardDateRangeProps {
  /** The preset the page shows; absent when a custom `from`/`to` range won. */
  preset?: DateRangePreset;
  /** The custom range's bounds as ISO instants, shown when no preset applies. */
  from?: string;
  to?: string;
  /** Presets the picker offers, from the dashboard's `dateRange.presets`. */
  presets?: readonly DateRangePreset[];
}

export function DashboardDateRange({ preset, from, to, presets }: DashboardDateRangeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlPreset = searchParams?.get("preset") ?? null;

  useEffect(() => {
    if (urlPreset === null || urlPreset === preset) return;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("preset");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [urlPreset, preset, searchParams, pathname, router]);

  return (
    <DateRangePicker
      value={preset ? { preset } : from && to ? { from: new Date(from), to: new Date(to) } : {}}
      {...(presets ? { presets } : {})}
      onChange={(next) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        dropTimelinePages(params);
        params.delete("from");
        params.delete("to");
        if (next.preset) params.set("preset", next.preset);
        else params.delete("preset");
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
      }}
    />
  );
}
