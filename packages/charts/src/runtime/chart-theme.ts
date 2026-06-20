import { formatNumber, type NumericFormat } from "@flowpanel/react";
import type { ReactNode } from "react";

/** Shared recharts prop literals for the runtime chart components. */

/** Tooltip panel chrome — theme-token colors so it follows light/dark. */
export const TOOLTIP_CONTENT_STYLE = {
  background: "hsl(var(--fp-bg-1))",
  border: "1px solid hsl(var(--fp-border-1))",
  borderRadius: "var(--fp-radius)",
  color: "hsl(var(--fp-text-1))",
} as const;

/** Tighter tooltip chrome for `tooltip: "compact"` — smaller padding/text. */
export const TOOLTIP_CONTENT_STYLE_COMPACT = {
  ...TOOLTIP_CONTENT_STYLE,
  padding: "4px 8px",
  fontSize: 12,
} as const;

const CHART_HUES = [
  "217 91% 60%", // blue
  "142 70% 45%", // green
  "38 92% 50%", // amber
  "0 84% 60%", // red
  "262 83% 67%", // violet
  "199 89% 48%", // cyan
  "330 81% 60%", // pink
] as const;

/** Resolve the i-th palette color as an opaque `hsl()` string. */
export function chartColor(i: number): string {
  return `hsl(${CHART_HUES[i % CHART_HUES.length]})`;
}

/** Same palette color at partial opacity — for area-chart fills. */
export function chartColorAlpha(i: number, alpha: number): string {
  return `hsl(${CHART_HUES[i % CHART_HUES.length]} / ${alpha})`;
}

/** Legend chrome for multi-series cartesian charts — matches axis text tone. */
export const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 12, color: "hsl(var(--fp-text-3))" },
  iconType: "circle",
  iconSize: 8,
} as const;

export function buildValueTickFormatter(
  format: NumericFormat | undefined,
): ((value: unknown) => string) | undefined {
  if (!format) return undefined;
  return (value) => (typeof value === "number" ? formatNumber(value, format) : String(value));
}

/** Resolve the extra `<Tooltip>` props driven by `ChartOptionsBase.format` and `.tooltip`. */
export function buildTooltipProps(
  format: NumericFormat | undefined,
  tooltip: "default" | "compact" | false | undefined,
) {
  const compact = tooltip === "compact";
  return {
    contentStyle: compact ? TOOLTIP_CONTENT_STYLE_COMPACT : TOOLTIP_CONTENT_STYLE,
    ...(compact ? { labelFormatter: () => null } : {}),
    ...(format
      ? {
          formatter: (value: unknown): ReactNode =>
            (typeof value === "number" ? formatNumber(value, format) : value) as ReactNode,
        }
      : {}),
  };
}

/** Hover cursor for line/area charts — a thin vertical rule. */
export const LINE_TOOLTIP_CURSOR = {
  stroke: "hsl(var(--fp-border-2))",
  strokeWidth: 1,
} as const;

/** Hover cursor for bar charts — a faint band highlight. */
export const BAR_TOOLTIP_CURSOR = { fill: "hsl(var(--fp-text-1) / 0.06)" } as const;

export const AXIS_TICK_PROPS = {
  interval: "preserveStartEnd",
  minTickGap: 48,
} as const;

export const CHART_SURFACE_PROPS = { accessibilityLayer: false } as const;

export const STATIC_SERIES_PROPS = { isAnimationActive: false } as const;
