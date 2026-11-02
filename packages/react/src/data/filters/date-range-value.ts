import { type CalendarRange, fromISODate, toISODate } from "../Calendar";

function dayIn(instant: string, timeZone: string): Date | null {
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return null;
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return fromISODate(day);
}

/** `[from, to]` as local dates; a `from~to` instant pair reads as its days in `timeZone`. */
export function parseDateRangeValue(value: string | null, timeZone: string): CalendarRange {
  const raw = value ?? "";
  if (raw.includes("~")) {
    const [from = "", to = ""] = raw.split("~");
    return { from: dayIn(from, timeZone), to: dayIn(to, timeZone) };
  }
  const [from = "", to = ""] = raw.split(":");
  return { from: fromISODate(from), to: fromISODate(to) };
}

export function serializeDateRange(range: CalendarRange): string | null {
  const from = range.from ? toISODate(range.from) : "";
  const to = range.to ? toISODate(range.to) : "";
  return from === "" && to === "" ? null : `${from}:${to}`;
}
