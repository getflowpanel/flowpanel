const DAY_MS = 86_400_000;

/**
 * A range of the same length ending where `range` begins. The shift is elapsed
 * time, not calendar days, so the comparison window for a week that crosses a DST
 * boundary starts an hour off the wall clock.
 */
export function previousRange(range: { from: Date; to: Date }): { from: Date; to: Date } {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime()) };
}

function zoneDay(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayOf(value: unknown, timeZone: string): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : zoneDay(value, timeZone);
  if (typeof value === "number") return zoneDay(new Date(value), timeZone);
  if (typeof value !== "string" || value === "") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : zoneDay(parsed, timeZone);
}

/**
 * Turn sparse grouped rows into one point per day across `range`, so a chart
 * draws a flat stretch where nothing happened instead of skipping the day.
 * Bucketing is done in `timeZone`, which defaults to UTC. There is one bucket per
 * calendar day the range touches, both ends included, so the `last7d` preset —
 * `now - 7d … now` — yields eight buckets whose first is a partial day.
 */
export function fillDays<R>(
  rows: R[],
  range: { from: Date; to: Date },
  opts: { dateField: keyof R & string; valueField: keyof R & string; timeZone?: string },
): Array<{ date: string; value: number }> {
  const timeZone = opts.timeZone ?? "UTC";
  const totals = new Map<string, number>();
  for (const row of rows) {
    const day = dayOf((row as Record<string, unknown>)[opts.dateField], timeZone);
    if (day === null) continue;
    const raw = Number((row as Record<string, unknown>)[opts.valueField]);
    totals.set(day, (totals.get(day) ?? 0) + (Number.isFinite(raw) ? raw : 0));
  }

  const end = Date.parse(`${zoneDay(range.to, timeZone)}T00:00:00Z`);
  const out: Array<{ date: string; value: number }> = [];
  for (
    let cursor = Date.parse(`${zoneDay(range.from, timeZone)}T00:00:00Z`);
    cursor <= end;
    cursor += DAY_MS
  ) {
    const date = new Date(cursor).toISOString().slice(0, 10);
    out.push({ date, value: totals.get(date) ?? 0 });
  }
  return out;
}
