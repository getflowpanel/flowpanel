import { formatCalendarDay, zonedTime, zoneParts } from "./zone-time";

const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

/** `YYYY-MM-DDTHH:mm`, a `datetime-local` value, as `timeZone`'s wall clock shows the instant. */
export function wallTimeIn(instant: Date, timeZone: string): string {
  const p = zoneParts(instant, timeZone);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${formatCalendarDay(p)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** A `datetime-local` value read on `timeZone`'s wall clock; an invalid `Date` for a day or time that does not exist, `null` for other text. */
export function parseWallTime(text: string, timeZone: string): Date | null {
  const m = WALL_TIME.exec(text);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = [1, 2, 3, 4, 5, 6].map((i) =>
    Number(m[i] ?? 0),
  ) as [number, number, number, number, number, number];
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const exists = month >= 1 && month <= 12 && day >= 1 && day <= lastDay;
  if (!exists || hour > 23 || minute > 59 || second > 59) return new Date(Number.NaN);
  const ms = ((hour * 60 + minute) * 60 + second) * 1000 + Number((m[7] ?? "").padEnd(3, "0"));
  return zonedTime({ year, month, day }, ms, timeZone);
}
