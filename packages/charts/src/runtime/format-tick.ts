import type { ChartBucket } from "@flowpanel/core";

/**
 * Format an x-axis tick value. When the data are dates (Date objects or
 * ISO-like strings) and the aggregation bucket is daily-or-coarser, the
 * `00:00:00` time component is stripped — daily-aggregated data spelling
 * full timestamps is pure noise.
 *
 * `bucket="auto"` (default) infers granularity from the gap between
 * consecutive x-values: if every gap is ≥24h the bucket is treated as
 * `"day"` (or coarser). Anything finer keeps the time component.
 */
export function formatTick(value: unknown, bucket: ChartBucket = "auto"): string {
  const date = toDate(value);
  if (date === null) {
    // Not a date — render as-is.
    return value == null ? "" : String(value);
  }

  switch (bucket) {
    case "day":
    case "week":
    case "month":
    case "year":
      return formatDateOnly(date);
    case "hour":
      return formatToMinute(date);
    case "minute":
      return formatToMinute(date);
    default:
      // auto — fall through to caller's inferred bucket if any; otherwise
      // default to date-only (the common dashboard case).
      return formatDateOnly(date);
  }
}

/**
 * Build a tick formatter closure for a chart. Inspects the dataset once to
 * infer bucket granularity when `bucket` is `"auto"` (or missing). The
 * returned function is suitable for `recharts`' `XAxis` `tickFormatter`.
 */
export function buildTickFormatter(
  data: ReadonlyArray<Record<string, unknown>>,
  xKey: string,
  bucket: ChartBucket | undefined,
): (value: unknown) => string {
  const resolved = bucket && bucket !== "auto" ? bucket : inferBucket(data, xKey);
  if (resolved === null) {
    // x-axis isn't a date — pass through to default string coercion.
    return (value) => (value == null ? "" : String(value));
  }
  return (value) => formatTick(value, resolved);
}

/**
 * Infer `"day"` vs `"hour"` from the spacing between the first few x-values.
 * Returns `null` if values aren't dates.
 */
export function inferBucket(
  data: ReadonlyArray<Record<string, unknown>>,
  xKey: string,
): ChartBucket | null {
  if (data.length === 0) return null;
  const first = toDate(data[0]?.[xKey]);
  if (first === null) return null;
  if (data.length === 1) return "day";

  const DAY_MS = 24 * 60 * 60 * 1000;
  // Sample up to first 5 gaps; if every gap is ≥ ~23h we call it day-or-coarser.
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
    // 23h threshold tolerates DST shifts.
    if (gap < 23 * 60 * 60 * 1000) {
      everyGapDaily = false;
      break;
    }
    if (gap < DAY_MS * 1000) {
      // still under a year — fine
    }
  }
  return everyGapDaily ? "day" : "hour";
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    // Accept ISO-like strings (YYYY-MM-DD, YYYY-MM-DDTHH:mm:ss, etc.).
    // Reject plain category strings — heuristic: must start with 4 digits + dash.
    if (!/^\d{4}-\d{2}/.test(value)) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // Treat as epoch ms only if it looks like a reasonable timestamp
    // (post-1990). Avoids accidentally formatting numeric categories.
    if (value > 6.31e11) {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatToMinute(d: Date): string {
  return `${formatDateOnly(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
