import type { ColumnMeta, FieldDef } from "@flowpanel/core";
import { formatCalendarDay, wallTimeIn, zoneParts } from "@flowpanel/core/internal";

export type DateInput = "date" | "datetime-local";

/** The date control a form field renders, or `undefined` for any other control. */
export function dateInputFor(
  field: Pick<FieldDef<Record<string, unknown>>, "type"> | undefined,
  column: Pick<ColumnMeta, "type" | "dateOnly"> | undefined,
): DateInput | undefined {
  if (field) {
    if (field.type === "date") return "date";
    return field.type === "datetime" ? "datetime-local" : undefined;
  }
  if (column?.type !== "date") return undefined;
  return column.dateOnly ? "date" : "datetime-local";
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
  if (input === "datetime-local") return wallTimeIn(instant, timeZone);
  const calendarDay = instant.getTime() % 86_400_000 === 0;
  return formatCalendarDay(zoneParts(instant, calendarDay ? "UTC" : timeZone));
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
