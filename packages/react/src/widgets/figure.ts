import type * as React from "react";

const MOST_CHARS = 40;

/** A KPI figure: every cell of a `StatStrip` draws its value at this size. */
export const FIGURE =
  "fp-figure fp-text-[2rem] fp-font-semibold fp-leading-tight fp-tracking-tight fp-tabular-nums";

/** Shrinks a figure below 2rem only when its characters would not fit the width of its container (rules in admin.css). */
export function figureSize(text: React.ReactNode): { "data-fp-figure"?: string } {
  if (typeof text !== "string" && typeof text !== "number") return {};
  return { "data-fp-figure": String(Math.min(Math.max(String(text).length, 1), MOST_CHARS)) };
}
