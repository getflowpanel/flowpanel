import { formatCalendarDay, parseCalendarDay, shiftCalendarDays, zoneParts } from "./zone-time";

const clocks = new Map<string, Intl.DateTimeFormat>();

/** The calendar day of `at` in `timeZone`, as `YYYY-MM-DD`. */
export function dayKeyIn(at: Date, timeZone: string): string {
  return formatCalendarDay(zoneParts(at, timeZone));
}

/** A `YYYY-MM-DD` day moved by whole calendar days. */
export function shiftDayKey(day: string, by: number): string {
  const parsed = parseCalendarDay(day);
  if (!parsed) throw new RangeError("Invalid time value");
  return formatCalendarDay(shiftCalendarDays(parsed, by));
}

/** The weekday of a `YYYY-MM-DD` day: 1 = Monday … 7 = Sunday. */
export function weekdayOf(day: string): number {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function offsetMs(at: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(new Date(at))
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<string, number>;
  const wall = Date.UTC(
    parts.year ?? 0,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0,
  );
  return wall - (at - (at % 1000));
}

/** The instant a `YYYY-MM-DD` day starts in `timeZone`. */
export function dayStartIn(day: string, timeZone: string): Date {
  const midnight = Date.parse(`${day}T00:00:00Z`);
  const guess = midnight - offsetMs(midnight, timeZone);
  return new Date(midnight - offsetMs(guess, timeZone));
}

/** The wall clock of `at` in `timeZone`, 24-hour — `09:12`. */
export function clockIn(at: Date, timeZone: string, locale: string): string {
  const key = `${locale}|${timeZone}`;
  let format = clocks.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    clocks.set(key, format);
  }
  return format.format(at);
}
