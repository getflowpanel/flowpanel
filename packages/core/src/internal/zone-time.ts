import type { DateRangePreset } from "../types/dashboard";

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

export interface ZoneParts extends CalendarDay {
  hour: number;
  minute: number;
  second: number;
}

const CALENDAR_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A `YYYY-MM-DD` string: a calendar day, which belongs to no zone. */
export function isCalendarDayString(value: unknown): value is string {
  return typeof value === "string" && CALENDAR_DAY.test(value);
}

/** Parse a `YYYY-MM-DD` string into its calendar day; `null` for anything else. */
export function parseCalendarDay(value: string): CalendarDay | null {
  const match = CALENDAR_DAY.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

/** `YYYY-MM-DD` for a calendar day. */
export function formatCalendarDay({ year, month, day }: CalendarDay): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

const MS_DAY = 86_400_000;
const FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const known = FORMATTERS.get(timeZone);
  if (known) return known;
  const made = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  FORMATTERS.set(timeZone, made);
  return made;
}

/** The wall clock an instant shows in `timeZone`. */
export function zoneParts(instant: Date, timeZone: string): ZoneParts {
  const parts: Record<string, number> = {};
  for (const part of formatterFor(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year ?? 1970,
    month: parts.month ?? 1,
    day: parts.day ?? 1,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

function offsetMs(instant: number, timeZone: string): number {
  const p = zoneParts(new Date(instant), timeZone);
  const wall = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wall - Math.floor(instant / 1000) * 1000;
}

/**
 * The instant a clock time on a calendar day falls on in `timeZone`, found across a DST change.
 * A time the clocks skip moves forward past the gap.
 */
export function zonedTime(
  { year, month, day }: CalendarDay,
  msOfDay: number,
  timeZone: string,
): Date {
  const wall = Date.UTC(year, month - 1, day) + msOfDay;
  const guess = wall - offsetMs(wall, timeZone);
  const found = wall - offsetMs(guess, timeZone);
  return new Date(offsetMs(found, timeZone) === wall - found ? found : Math.max(guess, found));
}

/** A calendar day moved by whole days. */
export function shiftCalendarDays({ year, month, day }: CalendarDay, days: number): CalendarDay {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

/** A calendar day moved by whole months, clamped to the last day of a shorter month. */
export function shiftCalendarMonths(
  { year, month, day }: CalendarDay,
  months: number,
): CalendarDay {
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  return { year: first.getUTCFullYear(), month: first.getUTCMonth() + 1, day: Math.min(day, last) };
}

/**
 * A preset's range at `now` in `timeZone`. Day, month, quarter and year presets
 * start at midnight in the zone; `last7d` and `last30d` are elapsed time.
 */
export function resolvePreset(
  preset: DateRangePreset,
  timeZone: string,
  now: Date,
): { from: Date; to: Date } {
  const today: CalendarDay = zoneParts(now, timeZone);
  const midnight = (day: CalendarDay) => zonedTime(day, 0, timeZone);
  switch (preset) {
    case "today":
      return { from: midnight(today), to: now };
    case "yesterday":
      return {
        from: midnight(shiftCalendarDays(today, -1)),
        to: new Date(midnight(today).getTime() - 1),
      };
    case "last7d":
      return { from: new Date(now.getTime() - 7 * MS_DAY), to: now };
    case "last30d":
      return { from: new Date(now.getTime() - 30 * MS_DAY), to: now };
    case "MTD":
      return { from: midnight({ ...today, day: 1 }), to: now };
    case "QTD":
      return {
        from: midnight({ ...today, month: today.month - ((today.month - 1) % 3), day: 1 }),
        to: now,
      };
    case "YTD":
      return { from: midnight({ year: today.year, month: 1, day: 1 }), to: now };
  }
}
