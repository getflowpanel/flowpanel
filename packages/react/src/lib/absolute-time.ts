import { formatDateTime } from "@flowpanel/core/format";

/** The exact moment with its time zone, for the tooltip of a relative or zone-shifted time. */
export function absoluteTime(date: Date, locale: string, timeZone?: string): string {
  return formatDateTime(date, locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
    ...(timeZone ? { timeZone } : {}),
  });
}
