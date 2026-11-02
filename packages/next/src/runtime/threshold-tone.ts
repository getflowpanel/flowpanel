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

/** A card's tone: what its query said, muted when it has no value, else its static or threshold tone. */
export function valueTone(
  result: { value: unknown; tone?: Tone | undefined; volume?: number | undefined },
  options: {
    tone?: Tone | undefined;
    tones?: Threshold | undefined;
    goodWhen?: string | undefined;
  },
): Tone | undefined {
  if (result.tone) return result.tone;
  if (result.value === null || result.value === undefined) return "muted";
  return (
    options.tone ?? thresholdTone(result.value, options.tones, result.volume, options.goodWhen)
  );
}
