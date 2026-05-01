"use client";
import type { DateRangePreset } from "@flowpanel/core";
import { DateRangePicker } from "@flowpanel/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface DashboardDateRangeProps {
  preset?: DateRangePreset;
}

/**
 * Client wrapper that reads the current `?preset` from the URL and writes the
 * new selection back via Next's router. Mounted inside the RSC DashboardPage.
 */
export function DashboardDateRange({ preset }: DashboardDateRangeProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <DateRangePicker
      value={preset ? { preset } : {}}
      onChange={(next) => {
        const params = new URLSearchParams(searchParams?.toString() ?? "");
        if (next.preset) params.set("preset", next.preset);
        else params.delete("preset");
        const query = params.toString();
        router.push(query ? `${pathname}?${query}` : pathname);
      }}
    />
  );
}
