/** A chart's height when its options set none and its card is narrow. */
export const CHART_HEIGHT = 240;

export interface ChartBox {
  width?: string;
  height?: number;
  aspectRatio?: string;
  minHeight?: number;
  maxHeight?: number;
}

/** The box a chart draws in: its set height, else 2/7 of its width within 240 to 320 px, so a wide chart is not flat. */
export function chartBox(height?: number): ChartBox {
  if (height !== undefined) return { height };
  return { width: "100%", aspectRatio: "7 / 2", minHeight: CHART_HEIGHT, maxHeight: 320 };
}
