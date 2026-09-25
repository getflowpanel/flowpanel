import type { MetricDelta } from "@flowpanel/core";
import {
  DEFAULT_FORMATTING,
  formatNumber,
  formatPercentValue,
  type NumericFormat,
  type ResolvedFormatting,
} from "@flowpanel/core/format";
import { DEFAULT_LABELS, formatLabel } from "@flowpanel/core/labels";

/** Which direction of a change is good news. */
export type GoodWhen = NonNullable<MetricDelta["goodWhen"]>;
export type DeltaMood = "good" | "bad" | "flat";

export interface DeltaView {
  glyph: "▲" | "▼" | "";
  text: string;
  mood: DeltaMood;
}

/** How a change's numbers print: a value in its own format, a fraction, percentage points. */
export interface DeltaPrint {
  value: (n: number) => string;
  percent: (fraction: number) => string;
  points: (points: number) => string;
}

/** A relative change inside this fraction reads as no change. */
export const NEUTRAL_BAND = 0.01;
/** Below this count a percentage exaggerates, so the absolute change is shown. */
export const SMALL_BASE = 20;

/** The printers a card hands `describeDelta`, in the admin's locale. */
export function deltaPrint(
  format: NumericFormat | undefined,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
  pointsLabel: string = DEFAULT_LABELS.widget.points,
): DeltaPrint {
  const onePlace = new Intl.NumberFormat(formatting.locale, { maximumFractionDigits: 1 });
  return {
    value: (n) => formatNumber(n, format, formatting),
    percent: (fraction) => formatPercentValue(fraction, formatting, 1),
    points: (n) => formatLabel(pointsLabel, { value: onePlace.format(n) }),
  };
}

function differenceText(
  previous: number | undefined,
  current: number | string,
  format: NumericFormat | undefined,
  print: DeltaPrint,
  sign: string,
): string | null {
  if (typeof current !== "number" || previous === undefined) return null;
  if (format === "percent") return `${sign}${print.points(Math.abs(current - previous) * 100)}`;
  const count = (format === undefined || format === "number") && Number.isInteger(previous);
  if (!count || Math.abs(previous) >= SMALL_BASE) return null;
  return `${sign}${print.value(Math.abs(current - previous))}`;
}

/** How a change reads: its glyph, its text, and whether it is good news, bad news or neither. */
export function describeDelta(
  delta: { value: number; previous?: number | undefined; goodWhen?: GoodWhen | undefined },
  current: number | string,
  format: NumericFormat | undefined,
  print: DeltaPrint,
): DeltaView {
  const flat = Math.abs(delta.value) < NEUTRAL_BAND;
  const glyph = flat ? "" : delta.value > 0 ? "▲" : "▼";
  const sign = flat ? "" : delta.value > 0 ? "+" : "−";
  const text =
    differenceText(delta.previous, current, format, print, sign) ??
    print.percent(Math.abs(delta.value));
  if (flat || delta.goodWhen === "neutral") return { glyph, text, mood: "flat" };
  const good = delta.goodWhen === "down" ? delta.value < 0 : delta.value > 0;
  return { glyph, text, mood: good ? "good" : "bad" };
}
