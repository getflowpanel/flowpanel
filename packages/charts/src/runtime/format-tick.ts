import type { ChartBucket } from "@flowpanel/core";

/** Format an x-axis tick value. */
export function formatTick(value: unknown, bucket: ChartBucket = "auto"): string {
  const date = toDate(value);
  if (date === null) {
    return value == null ? "" : String(value);
  }

  return bucket === "hour" || bucket === "minute" ? formatToMinute(date) : formatDateOnly(date);
}

/** Build a tick formatter closure for a chart. */
export function buildTickFormatter(
  data: ReadonlyArray<Record<string, unknown>>,
  xKey: string,
  bucket: ChartBucket | undefined,
): (value: unknown) => string {
  const resolved = bucket && bucket !== "auto" ? bucket : inferBucket(data, xKey);
  if (resolved === null) {
    return (value) => (value == null ? "" : String(value));
  }
  return (value) => formatTick(value, resolved);
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

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string") {
    if (!/^\d{4}-\d{2}/.test(value)) return null;
    const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      const local = new Date(Number(y), Number(m) - 1, Number(d));
      return Number.isNaN(local.getTime()) ? null : local;
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

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatDateOnly(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatToMinute(d: Date): string {
  return `${formatDateOnly(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
