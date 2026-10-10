const BAR_WIDTHS = [
  "fp-w-0",
  "fp-w-[5%]",
  "fp-w-[10%]",
  "fp-w-[15%]",
  "fp-w-[20%]",
  "fp-w-[25%]",
  "fp-w-[30%]",
  "fp-w-[35%]",
  "fp-w-[40%]",
  "fp-w-[45%]",
  "fp-w-[50%]",
  "fp-w-[55%]",
  "fp-w-[60%]",
  "fp-w-[65%]",
  "fp-w-[70%]",
  "fp-w-[75%]",
  "fp-w-[80%]",
  "fp-w-[85%]",
  "fp-w-[90%]",
  "fp-w-[95%]",
  "fp-w-full",
];

/** A bar's width has to be a class Tailwind can see, so a share snaps to a 5% step. */
export function barWidthClass(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return "fp-w-0";
  const step = Math.min(20, Math.max(1, Math.round(share * 20)));
  return BAR_WIDTHS[step] ?? "fp-w-full";
}

/** Share of the largest value in a set, so the tallest bar always fills the track. */
export function shareOfMax(value: number, max: number): number {
  return max > 0 ? value / max : 0;
}
