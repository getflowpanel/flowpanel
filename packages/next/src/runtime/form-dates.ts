import type { FieldDef } from "@flowpanel/core";
import { formatCalendarDay, zonedTime, zoneParts } from "@flowpanel/core/internal";

export type DateInput = "date" | "datetime-local";

const WALL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** The date control a form field renders, or `undefined` for any other control. */
export function dateInputFor(
  field: Pick<FieldDef<Record<string, unknown>>, "type"> | undefined,
  columnType: string | undefined,
): DateInput | undefined {
  if (field) {
    if (field.type === "date") return "date";
    return field.type === "datetime" ? "datetime-local" : undefined;
  }
  return columnType === "date" ? "datetime-local" : undefined;
}

/**
 * A stored value as the control shows it: `YYYY-MM-DDTHH:mm` on the admin's wall clock, or `YYYY-MM-DD`.
 * A date at midnight UTC is a calendar day, as a SQL `date` column reads, so it keeps its day.
 */
export function dateInputValue(value: unknown, input: DateInput, timeZone: string): unknown {
  const instant =
    value instanceof Date ? value : typeof value === "string" ? new Date(value) : undefined;
  if (!instant || Number.isNaN(instant.getTime())) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return input === "date" ? value : `${value}T00:00`;
  }
  const calendarDay = input === "date" && instant.getTime() % 86_400_000 === 0;
  const p = zoneParts(instant, calendarDay ? "UTC" : timeZone);
  const day = formatCalendarDay(p);
  return input === "date" ? day : `${day}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** A `datetime-local` value read on the admin's wall clock; `null` for any other text. */
export function parseWallTime(text: string, timeZone: string): Date | null {
  const m = WALL_TIME.exec(text);
  if (!m) return null;
  const [hour, minute, second] = [Number(m[4]), Number(m[5]), Number(m[6] ?? 0)];
  const ms = ((hour * 60 + minute) * 60 + second) * 1000;
  return zonedTime({ year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) }, ms, timeZone);
}

const MINUTE = 60_000;

/**
 * Drops a posted timestamp that shows the same minute as the stored one, since the control cannot
 * carry seconds: an untouched date field keeps its stored value instead of losing its seconds.
 */
export function keepUntouchedTimes(
  input: unknown,
  current: Record<string, unknown>,
  dateColumns: ReadonlySet<string>,
): unknown {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return input;
  const out: Record<string, unknown> = { ...input };
  for (const name of dateColumns) {
    const posted = out[name];
    const stored = current[name];
    if (!(posted instanceof Date)) continue;
    const before =
      stored instanceof Date ? stored : typeof stored === "string" ? new Date(stored) : null;
    if (!before || Number.isNaN(before.getTime())) continue;
    if (Math.floor(before.getTime() / MINUTE) === Math.floor(posted.getTime() / MINUTE)) {
      delete out[name];
    }
  }
  return out;
}
