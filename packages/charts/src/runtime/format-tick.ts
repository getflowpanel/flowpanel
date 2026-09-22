import type { ChartBucket } from "@flowpanel/core";
import {
  DEFAULT_FORMATTING,
  formatDateValue,
  formatDayValue,
  type ResolvedFormatting,
} from "@flowpanel/core/format";

/**
 * An x-value is either a calendar day (a `YYYY-MM-DD` string, which belongs to no
 * zone) or an instant. Only an instant is read in the admin's `timeZone`.
 */
type Tick = { date: Date; calendar: boolean };

/** Format an x-axis tick value in the admin's `dateLocale` and `timeZone`. */
export function formatTick(
  value: unknown,
  bucket: ChartBucket = "auto",
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): string {
  const tick = toTick(value);
  if (tick === null) {
    return value == null ? "" : String(value);
  }
  const zone = tick.calendar ? "UTC" : formatting.timeZone;
  return bucket === "hour" || bucket === "minute"
    ? formatDateValue(tick.date, formatting, zone)
    : formatDayValue(tick.date, formatting, zone);
}

/** Build a tick formatter closure for a chart. */
export function buildTickFormatter(
  data: ReadonlyArray<Record<string, unknown>>,
  xKey: string,
  bucket: ChartBucket | undefined,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): (value: unknown) => string {
  const resolved = bucket && bucket !== "auto" ? bucket : inferBucket(data, xKey);
  if (resolved === null) {
    return (value) => (value == null ? "" : String(value));
  }
  return (value) => formatTick(value, resolved, formatting);
}

/** Infer `"day"` vs `"hour"` from the spacing between the first few x-values. */
function inferBucket(
  data: ReadonlyArray<Record<string, unknown>>,
  xKey: string,
): ChartBucket | null {
  if (data.length === 0) return null;
  const first = toDate(data[0]?.[xKey]);
  if (first === null) return null;
  if (data.length === 1) return "day";

  const sampleEnd = Math.min(data.length, 6);
  let everyGapDaily = true;
  for (let i = 1; i < sampleEnd; i++) {
    const a = toDate(data[i - 1]?.[xKey]);
    const b = toDate(data[i]?.[xKey]);
    if (a === null || b === null) {
      everyGapDaily = false;
      break;
    }
    const gap = Math.abs(b.getTime() - a.getTime());
    if (gap < 23 * 60 * 60 * 1000) {
      everyGapDaily = false;
      break;
    }
  }
  return everyGapDaily ? "day" : "hour";
}

function toTick(value: unknown): Tick | null {
  if (typeof value === "string") {
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      const utc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      return Number.isNaN(utc.getTime()) ? null : { date: utc, calendar: true };
    }
  }
  const date = toDate(value);
  return date === null ? null : { date, calendar: false };
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    if (!/^\d{4}-\d{2}/.test(value)) return null;
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      const utc = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
      return Number.isNaN(utc.getTime()) ? null : utc;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value > 6.31e11) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}
