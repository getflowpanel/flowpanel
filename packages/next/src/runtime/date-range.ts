import type { DateRangePreset, ResolvedDateRange } from "@flowpanel/core";
import {
  previousRange,
  resolvePreset,
  shiftCalendarDays,
  shiftCalendarMonths,
  zonedTime,
  zoneParts,
} from "@flowpanel/core";

export interface DateRangeInput {
  preset?: DateRangePreset;
  from?: Date | string;
  to?: Date | string;
}

/** Every preset a dashboard picker, a comparison and a `daterange` filter value understand. */
export const DATE_RANGE_PRESETS: readonly DateRangePreset[] = [
  "today",
  "yesterday",
  "last7d",
  "last30d",
  "MTD",
  "QTD",
  "YTD",
];

export function isDateRangePreset(value: string): value is DateRangePreset {
  return (DATE_RANGE_PRESETS as readonly string[]).includes(value);
}

type Span = { from: Date; to: Date };

function shiftInstant(
  instant: Date,
  timeZone: string,
  by: { days?: number; months?: number },
): Date {
  const parts = zoneParts(instant, timeZone);
  const clock = (parts.hour * 3600 + parts.minute * 60 + parts.second) * 1000;
  const target =
    by.months === undefined
      ? shiftCalendarDays(parts, by.days ?? 0)
      : shiftCalendarMonths(parts, by.months);
  return zonedTime(target, clock + (instant.getTime() % 1000), timeZone);
}

/**
 * Resolve a preset or an explicit range. Day, month, quarter and year presets
 * start at midnight in `timeZone`; `last7d` and `last30d` are elapsed time.
 */
export function resolveDateRange(input: DateRangeInput, timeZone = "UTC"): ResolvedDateRange {
  if (input.from && input.to) {
    return { from: new Date(input.from), to: new Date(input.to), preset: "custom" };
  }
  const preset = input.preset ?? "last7d";
  return { ...resolvePreset(preset, timeZone, new Date()), preset };
}

/** Both bounds moved by calendar days or months, each at the same clock time in `timeZone`. */
export function shiftRange(
  range: Span,
  timeZone: string,
  by: { days?: number; months?: number },
): Span {
  return { from: shiftInstant(range.from, timeZone, by), to: shiftInstant(range.to, timeZone, by) };
}

/**
 * The period a range is compared with: the same stretch one day, month, quarter or year
 * back for a calendar preset, and the span of the same length before it otherwise.
 */
export function previousRangeFor(range: ResolvedDateRange, timeZone: string): Span {
  switch (range.preset) {
    case "today":
      return shiftRange(range, timeZone, { days: -1 });
    case "yesterday":
      return {
        from: shiftInstant(range.from, timeZone, { days: -1 }),
        to: new Date(range.from.getTime() - 1),
      };
    case "MTD":
      return shiftRange(range, timeZone, { months: -1 });
    case "QTD":
      return shiftRange(range, timeZone, { months: -3 });
    case "YTD":
      return shiftRange(range, timeZone, { months: -12 });
    default:
      return previousRange(range);
  }
}

/** The first and last millisecond of a `YYYY-MM-DD` day in `timeZone`. */
export function dayBoundsIn(isoDay: string, timeZone: string): { start: Date; end: Date } {
  const [year = 1970, month = 1, day = 1] = isoDay.split("-").map(Number);
  const date = { year, month, day };
  return {
    start: zonedTime(date, 0, timeZone),
    end: new Date(zonedTime(shiftCalendarDays(date, 1), 0, timeZone).getTime() - 1),
  };
}
