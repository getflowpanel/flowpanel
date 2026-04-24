/**
 * Time-range utilities used by the metric helpers.
 *
 * `parseRange` accepts strings like "24h" / "30d" / "6M" and produces a
 * {start, end} window ending at `now`. `previousRange` shifts a window one
 * duration backward — used for vs-previous-period trend computation.
 * `defaultBucketFor` picks a sensible bucket size from a range's duration.
 */

import type { MetricBucket, MetricRange } from "./types";

const RANGE_RE = /^(\d+)(h|d|w|M)$/;

const MS_UNITS = {
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
} as const;

export function parseRange(spec: string, now: Date = new Date()): MetricRange {
  const m = RANGE_RE.exec(spec);
  if (!m) throw new Error(`Invalid range "${spec}". Expected "<number><h|d|w|M>", e.g. "30d".`);
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0)
    throw new Error(`Invalid range "${spec}". Expected positive integer.`);
  const unit = m[2] as "h" | "d" | "w" | "M";
  // "M" uses calendar months (setUTCMonth), not a 30-day approximation — so
  // "6M" on 2026-04-18 lands exactly on 2025-10-18, matching user intuition.
  if (unit === "M") {
    const start = new Date(now);
    start.setUTCMonth(start.getUTCMonth() - n);
    return { start, end: now };
  }
  return {
    start: new Date(now.getTime() - n * MS_UNITS[unit]),
    end: now,
  };
}

export function previousRange(range: MetricRange): MetricRange {
  const duration = range.end.getTime() - range.start.getTime();
  return {
    start: new Date(range.start.getTime() - duration),
    end: range.start,
  };
}

export function defaultBucketFor(range: MetricRange): MetricBucket {
  const hours = (range.end.getTime() - range.start.getTime()) / (60 * 60 * 1000);
  if (hours <= 48) return "hour";
  if (hours <= 60 * 24) return "day";
  if (hours <= 180 * 24) return "week";
  return "month";
}
