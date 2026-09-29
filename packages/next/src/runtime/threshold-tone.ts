import type { Threshold, Tone } from "@flowpanel/core";
import { toneFor } from "@flowpanel/core";

/** The tone `tones` gives a card value; `undefined` without a threshold. */
export function thresholdTone(
  value: unknown,
  tones: Threshold | undefined,
  volume?: number,
  goodWhen?: string,
): Tone | undefined {
  if (!tones) return undefined;
  const n =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;
  return toneFor(Number.isFinite(n) ? n : null, tones, volume, goodWhen);
}
