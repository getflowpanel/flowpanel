import type * as React from "react";

/** A KPI figure: every cell of a `StatStrip` draws its value at this size. */
export const FIGURE =
  "fp-text-[2rem] fp-font-semibold fp-leading-tight fp-tracking-tight fp-tabular-nums";

/** Shrinks a figure below 2rem only when its characters would not fit the width of its container. */
export function figureSize(text: React.ReactNode): React.CSSProperties | undefined {
  if (typeof text !== "string" && typeof text !== "number") return undefined;
  const chars = Math.max(String(text).length, 1);
  return { fontSize: `min(2rem, ${(100 / (chars * 0.6)).toFixed(2)}cqi)` };
}
