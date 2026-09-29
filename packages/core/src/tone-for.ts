import type { GoodWhen, Threshold } from "./types/threshold";
import type { Tone } from "./types/widget";

/** Which way a threshold reads: its own `goodWhen`, else its numbers, else `fallback`, else up. */
export function thresholdDirection(t: Threshold, fallback?: string): GoodWhen {
  if (t.goodWhen) return t.goodWhen;
  if (t.warn !== t.err) return t.warn < t.err ? "down" : "up";
  return fallback === "down" ? "down" : "up";
}

/** `ok`, `warn` or `err` for a value against a threshold; `muted` without a value or below `min`. */
export function toneFor(
  value: number | null | undefined,
  t: Threshold,
  volume?: number,
  goodWhen?: string,
): Tone {
  if (value === null || value === undefined || !Number.isFinite(value)) return "muted";
  if (t.min !== undefined && volume !== undefined && volume < t.min) return "muted";
  if (thresholdDirection(t, goodWhen) === "up") {
    return value <= t.err ? "err" : value <= t.warn ? "warn" : "ok";
  }
  return value >= t.err ? "err" : value >= t.warn ? "warn" : "ok";
}
