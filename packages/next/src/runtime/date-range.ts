import type { DateRangePreset, ResolvedDateRange } from "@flowpanel/core";
import { previousRange } from "@flowpanel/core";

export interface DateRangeInput {
  preset?: DateRangePreset;
  from?: Date | string;
  to?: Date | string;
}

interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

type Span = { from: Date; to: Date };

const MS_DAY = 86_400_000;

function partsIn(instant: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(instant);
  return Object.fromEntries(parts.map((part) => [part.type, Number(part.value)]));
}

function dayOf(parts: Record<string, number>): CalendarDay {
  return { year: parts.year ?? 1970, month: parts.month ?? 1, day: parts.day ?? 1 };
}

function offsetMs(instant: number, timeZone: string): number {
  const parts = partsIn(new Date(instant), timeZone);
  const wall = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant a clock time on a calendar day falls on in `timeZone`, found across a DST change.
 * A time the clocks skip moves forward past the gap.
 */
function zonedTime({ year, month, day }: CalendarDay, msOfDay: number, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, day) + msOfDay;
  const guess = wall - offsetMs(wall, timeZone);
  const found = wall - offsetMs(guess, timeZone);
  return new Date(offsetMs(found, timeZone) === wall - found ? found : Math.max(guess, found));
}

function midnight(day: CalendarDay, timeZone: string): Date {
  return zonedTime(day, 0, timeZone);
}

function shiftDays({ year, month, day }: CalendarDay, days: number): CalendarDay {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function shiftMonths({ year, month, day }: CalendarDay, months: number): CalendarDay {
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return { year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, day: Math.min(day, last) };
}

function shiftInstant(
  instant: Date,
  timeZone: string,
  by: { days?: number; months?: number },
): Date {
  const parts = partsIn(instant, timeZone);
  const clock = ((parts.hour ?? 0) * 3600 + (parts.minute ?? 0) * 60 + (parts.second ?? 0)) * 1000;
  const day = dayOf(parts);
  const target =
    by.months === undefined ? shiftDays(day, by.days ?? 0) : shiftMonths(day, by.months);
  return zonedTime(target, clock + (instant.getTime() % 1000), timeZone);
}

/**
 * Resolve a preset or an explicit range. Day, month, quarter and year presets
 * start at midnight in `timeZone`; `last7d` and `last30d` are elapsed time.
 */
export function resolveDateRange(input: DateRangeInput, timeZone = "UTC"): ResolvedDateRange {
  const now = new Date();
  if (input.from && input.to) {
    return { from: new Date(input.from), to: new Date(input.to), preset: "custom" };
  }
  const preset = input.preset ?? "last7d";
  const today = dayOf(partsIn(now, timeZone));
  switch (preset) {
    case "today":
      return { from: midnight(today, timeZone), to: now, preset };
    case "yesterday": {
      const start = midnight(today, timeZone);
      return {
        from: midnight(shiftDays(today, -1), timeZone),
        to: new Date(start.getTime() - 1),
        preset,
      };
    }
    case "last7d":
      return { from: new Date(now.getTime() - 7 * MS_DAY), to: now, preset };
    case "last30d":
      return { from: new Date(now.getTime() - 30 * MS_DAY), to: now, preset };
    case "MTD":
      return { from: midnight({ ...today, day: 1 }, timeZone), to: now, preset };
    case "QTD": {
      const month = today.month - ((today.month - 1) % 3);
      return { from: midnight({ ...today, month, day: 1 }, timeZone), to: now, preset };
    }
    case "YTD":
      return { from: midnight({ year: today.year, month: 1, day: 1 }, timeZone), to: now, preset };
  }
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
    start: midnight(date, timeZone),
    end: new Date(midnight(shiftDays(date, 1), timeZone).getTime() - 1),
  };
}
