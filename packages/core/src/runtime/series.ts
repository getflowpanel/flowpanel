import { toDateValue } from "../format-values";
import {
  type CalendarDay,
  formatCalendarDay,
  parseCalendarDay,
  shiftCalendarDays,
  shiftCalendarMonths,
  zonedTime,
  zoneParts,
} from "../internal/zone-time";

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const LARGE_FOLD = 50_000;

/** The column `series({ top })` and the row `breakdown({ top })` fold the smaller values into. */
export const OTHER_KEY = "__other__";

/** A bucket size; `"auto"` picks one from the range's length. */
export type Grain = "hour" | "day" | "week" | "month" | "auto";

/** How a bucket's rows become one number: a field to sum, or a function of the rows. */
export type Fold<R> = (keyof R & string) | ((rows: R[]) => number | null);

export interface SeriesOptions<R> {
  /** The timestamp or `YYYY-MM-DD` field that places a row in a bucket. */
  at: keyof R & string;
  /** How a bucket's rows become its number. Default: the row count. */
  value?: Fold<R>;
  /** One column per value of this field; without it the one column is `value`. */
  by?: keyof R & string;
  /** Values of `by` present as columns, in this order, even with no rows. */
  keys?: readonly string[];
  /**
   * `"auto"`: hours up to 2 days, days up to 92, weeks up to 400, else months. A week starts
   * on Monday, whatever the locale.
   * @defaultValue "auto"
   */
  grain?: Grain;
  /** Keep `keys` and the N largest other series; the rest fold into `OTHER_KEY`. */
  top?: number;
}

/** One bucket of a `series()` with `by`: its key, and one number per series. */
export interface SeriesRow {
  date: string;
  [series: string]: string | number | null;
}

type SeriesRange = { from: Date; to: Date; timeZone?: string };
type BucketGrain = Exclude<Grain, "auto">;

let warnedLarge = false;

function warnLargeFold(count: number): void {
  if (count <= LARGE_FOLD || warnedLarge || process.env.NODE_ENV === "production") return;
  warnedLarge = true;
  console.warn(
    `[flowpanel] series() folded ${count.toLocaleString("en-US")} rows in JavaScript; above ` +
      `about ${LARGE_FOLD.toLocaleString("en-US")}, group by hour in SQL first.`,
  );
}

/**
 * A range of the same length ending where `range` begins. The shift is elapsed
 * time, not calendar days, so the comparison window for a week that crosses a DST
 * boundary starts an hour off the wall clock.
 */
export function previousRange(range: { from: Date; to: Date }): { from: Date; to: Date } {
  const span = range.to.getTime() - range.from.getTime();
  return { from: new Date(range.from.getTime() - span), to: new Date(range.from.getTime()) };
}

const pad = (n: number): string => String(n).padStart(2, "0");

function mondayOf(day: CalendarDay): CalendarDay {
  const weekday = new Date(Date.UTC(day.year, day.month - 1, day.day)).getUTCDay();
  return shiftCalendarDays(day, -((weekday + 6) % 7));
}

function bucketKey(day: CalendarDay, hour: number, grain: BucketGrain): string {
  if (grain === "hour") return `${formatCalendarDay(day)}T${pad(hour)}:00`;
  if (grain === "day") return formatCalendarDay(day);
  if (grain === "week") return formatCalendarDay(mondayOf(day));
  return `${day.year}-${pad(day.month)}-01`;
}

function calendarDay(value: unknown): CalendarDay | null {
  return typeof value === "string" ? parseCalendarDay(value) : null;
}

function keyOf(value: unknown, timeZone: string, grain: BucketGrain): string | null {
  const day = calendarDay(value);
  if (day) return bucketKey(day, 0, grain);
  const instant = toDateValue(value);
  if (instant === null) return null;
  const parts = zoneParts(instant, timeZone);
  return bucketKey(parts, parts.hour, grain);
}

function firstRowAt<R>(rows: readonly R[], at: keyof R & string, timeZone: string): Date | null {
  let first: number | null = null;
  for (const row of rows) {
    const value = (row as Record<string, unknown>)[at];
    const day = calendarDay(value);
    const time = (day ? zonedTime(day, 0, timeZone) : toDateValue(value))?.getTime();
    if (time !== undefined && (first === null || time < first)) first = time;
  }
  return first === null ? null : new Date(first);
}

function bucketKeys(range: SeriesRange, timeZone: string, grain: BucketGrain): string[] {
  if (range.to.getTime() < range.from.getTime()) return [];
  if (grain === "hour") {
    const keys = new Set<string>();
    const start = zoneParts(range.from, timeZone);
    let cursor = zonedTime(start, start.hour * HOUR_MS, timeZone).getTime();
    for (; cursor <= range.to.getTime(); cursor += HOUR_MS) {
      const key = keyOf(new Date(cursor), timeZone, "hour");
      if (key !== null) keys.add(key);
    }
    return [...keys];
  }
  const last = bucketKey(zoneParts(range.to, timeZone), 0, grain);
  const first = zoneParts(range.from, timeZone);
  let day: CalendarDay =
    grain === "week" ? mondayOf(first) : grain === "month" ? { ...first, day: 1 } : first;
  const keys: string[] = [];
  for (let key = bucketKey(day, 0, grain); key <= last; key = bucketKey(day, 0, grain)) {
    keys.push(key);
    day =
      grain === "month"
        ? shiftCalendarMonths(day, 1)
        : shiftCalendarDays(day, grain === "week" ? 7 : 1);
  }
  return keys;
}

function autoGrain(range: SeriesRange): BucketGrain {
  const days = (range.to.getTime() - range.from.getTime()) / DAY_MS;
  if (days <= 2) return "hour";
  if (days <= 92) return "day";
  if (days <= 400) return "week";
  return "month";
}

/** A number, a `"12"` string, a bigint or a boolean as a number; anything else is `0`. */
export function toNumber(value: unknown): number {
  const n =
    typeof value === "bigint" || typeof value === "string" || typeof value === "boolean"
      ? Number(value)
      : value;
  return typeof n === "number" && Number.isFinite(n) ? n : 0;
}

/** One bucket's rows as its number: the count, a field's sum, or a function's result. */
export function foldRows<R>(rows: R[], fold: Fold<R> | undefined): number | null {
  if (fold === undefined) return rows.length;
  if (typeof fold === "function") return fold(rows);
  return rows.reduce((sum, row) => sum + toNumber((row as Record<string, unknown>)[fold]), 0);
}

function push<R>(groups: Map<string, R[]>, key: string, row: R): void {
  const group = groups.get(key);
  if (group) group.push(row);
  else groups.set(key, [row]);
}

function rankSeries<R>(
  groups: Map<string, R[]>,
  fold: Fold<R> | undefined,
  keys: readonly string[],
  top: number | undefined,
): { kept: string[]; folded: string[] } {
  const others = [...groups.keys()]
    .filter((key) => !keys.includes(key))
    .map((key) => ({ key, total: foldRows(groups.get(key) ?? [], fold) ?? 0 }))
    .sort((a, b) => b.total - a.total)
    .map(({ key }) => key);
  const room = top === undefined ? others.length : Math.max(0, top);
  return { kept: [...keys, ...others.slice(0, room)], folded: others.slice(room) };
}

/**
 * One point per bucket across `range` in its zone, gaps filled, one column per `by`
 * value — `value` without `by`. A bucket with no rows folds `[]`: `0` for a count or
 * a sum, whatever the function returns for a function.
 */
export function series<R>(
  rows: readonly R[],
  range: SeriesRange,
  opts: SeriesOptions<R> & { by?: undefined; value?: keyof R & string },
): Array<{ date: string; value: number }>;
export function series<R>(
  rows: readonly R[],
  range: SeriesRange,
  opts: SeriesOptions<R> & { by?: undefined },
): Array<{ date: string; value: number | null }>;
export function series<R>(
  rows: readonly R[],
  range: SeriesRange,
  opts: SeriesOptions<R>,
): SeriesRow[];
export function series<R>(
  rows: readonly R[],
  range: SeriesRange,
  opts: SeriesOptions<R>,
): SeriesRow[] {
  warnLargeFold(rows.length);
  const timeZone = range.timeZone ?? "UTC";
  const from = range.from.getTime() <= 0 ? firstRowAt(rows, opts.at, timeZone) : range.from;
  if (from === null) return [];
  const span = { from, to: range.to, timeZone };
  const grain = !opts.grain || opts.grain === "auto" ? autoGrain(span) : opts.grain;
  const buckets = bucketKeys(span, timeZone, grain);
  const known = new Set(buckets);
  const bySeries = new Map<string, R[]>();
  const cells = new Map<string, R[]>();
  for (const row of rows) {
    const record = row as Record<string, unknown>;
    const bucket = keyOf(record[opts.at], timeZone, grain);
    if (bucket === null || !known.has(bucket)) continue;
    const name = opts.by === undefined ? "value" : record[opts.by];
    if (name === null || name === undefined) continue;
    push(bySeries, String(name), row);
    push(cells, `${bucket}\u0000${String(name)}`, row);
  }
  const { kept, folded } =
    opts.by === undefined
      ? { kept: ["value"], folded: [] as string[] }
      : rankSeries(bySeries, opts.value, opts.keys ?? [], opts.top);
  const columns = folded.length > 0 ? [...kept, OTHER_KEY] : kept;
  return buckets.map((bucket) => {
    const point: SeriesRow = { date: bucket };
    for (const column of columns) {
      const members = column === OTHER_KEY ? folded : [column];
      const inBucket = members.flatMap((name) => cells.get(`${bucket}\u0000${name}`) ?? []);
      point[column] = foldRows(inBucket, opts.value);
    }
    return point;
  });
}

/**
 * Turn sparse grouped rows into one point per day across `range`, so a chart
 * draws a flat stretch where nothing happened instead of skipping the day.
 * Bucketing is done in `timeZone`, else the range's own `timeZone` — so `ctx.dateRange`
 * buckets in the admin's zone — else UTC. There is one bucket per calendar day the
 * range touches, both ends included, so the `last7d` preset — `now - 7d … now` —
 * yields eight buckets whose first is a partial day.
 */
export function fillDays<R>(
  rows: R[],
  range: { from: Date; to: Date; timeZone?: string },
  opts: { dateField: keyof R & string; valueField: keyof R & string; timeZone?: string },
): Array<{ date: string; value: number }> {
  const timeZone = opts.timeZone ?? range.timeZone ?? "UTC";
  return series(
    rows,
    { from: range.from, to: range.to, timeZone },
    { at: opts.dateField, value: opts.valueField, grain: "day" },
  );
}
