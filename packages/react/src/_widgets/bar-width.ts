const BAR_WIDTHS = [
  "w-0",
  "w-[5%]",
  "w-[10%]",
  "w-[15%]",
  "w-[20%]",
  "w-[25%]",
  "w-[30%]",
  "w-[35%]",
  "w-[40%]",
  "w-[45%]",
  "w-[50%]",
  "w-[55%]",
  "w-[60%]",
  "w-[65%]",
  "w-[70%]",
  "w-[75%]",
  "w-[80%]",
  "w-[85%]",
  "w-[90%]",
  "w-[95%]",
  "w-full",
];

/** A bar's width has to be a class Tailwind can see, so a share snaps to a 5% step. */
export function barWidthClass(share: number): string {
  if (!Number.isFinite(share) || share <= 0) return "w-0";
  const step = Math.min(20, Math.max(1, Math.round(share * 20)));
  return BAR_WIDTHS[step] ?? "w-full";
}

/** Share of the largest value in a set, so the tallest bar always fills the track. */
export function shareOfMax(value: number, max: number): number {
  return max > 0 ? value / max : 0;
}
