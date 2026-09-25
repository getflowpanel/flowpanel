import type { Threshold } from "./types/threshold";
import type { Tone } from "./types/widget";

/** `ok`, `warn` or `err` for a value against a threshold; `muted` without a value or below `min`. */
export function toneFor(value: number | null | undefined, t: Threshold, volume?: number): Tone {
  if (value === null || value === undefined || !Number.isFinite(value)) return "muted";
  if (t.min !== undefined && volume !== undefined && volume < t.min) return "muted";
  if (t.goodWhen === "up") return value <= t.err ? "err" : value <= t.warn ? "warn" : "ok";
  return value >= t.err ? "err" : value >= t.warn ? "warn" : "ok";
}
