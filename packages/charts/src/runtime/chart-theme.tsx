import { formatNumber, type NumericFormat } from "@flowpanel/react";
import { ChartTooltip } from "./ChartTooltip";

/** Shared recharts prop literals for the runtime chart components. */

/** Number of --fp-chart-N palette tokens declared in admin.css. */
const CHART_TOKENS = 7;

/** Resolve the i-th palette color — token-driven, so it retunes per scheme. */
export function chartColor(i: number): string {
  return `hsl(var(--fp-chart-${(i % CHART_TOKENS) + 1}))`;
}

/** Same palette color at partial opacity — for area-chart fills. */
export function chartColorAlpha(i: number, alpha: number): string {
  return `hsl(var(--fp-chart-${(i % CHART_TOKENS) + 1}) / ${alpha})`;
}

/** Legend chrome for multi-series charts — matches axis text tone. */
export const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 12, color: "hsl(var(--fp-text-3))" },
  iconType: "circle",
  iconSize: 8,
} as const;

/** Horizontal-only dashed hairline grid. */
export const GRID_PROPS = {
  stroke: "hsl(var(--fp-border-1))",
  strokeDasharray: "3 3",
  vertical: false,
} as const;

/** Quiet axes: no axis/tick lines, small muted tick text. */
export const AXIS_STYLE_PROPS = {
  axisLine: false,
  tickLine: false,
  stroke: "hsl(var(--fp-text-3))",
  tick: { fill: "hsl(var(--fp-text-3))", fontSize: 11 },
} as const;

/** Hover dot for line/area series — ringed with the surface color. */
export const ACTIVE_DOT_PROPS = { r: 4, strokeWidth: 2, stroke: "hsl(var(--fp-bg-1))" } as const;

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
  return {
    content: <ChartTooltip format={format} compact={tooltip === "compact"} />,
  };
}

/** Hover cursor for line/area charts — a dashed vertical rule, like the grid. */
export const LINE_TOOLTIP_CURSOR = {
  stroke: "hsl(var(--fp-text-3))",
  strokeWidth: 1,
  strokeDasharray: "3 3",
} as const;

/** Hover cursor for bar charts — a faint band highlight. */
export const BAR_TOOLTIP_CURSOR = { fill: "hsl(var(--fp-text-1) / 0.06)" } as const;

/**
 * A tick roughly every 150px. At the old 48px gap a wide chart printed a label
 * under every other bar — a band of timestamps nobody reads, competing with the
 * series for attention. Recharts drops ticks to satisfy the gap, so narrow
 * charts thin out on their own.
 */
export const AXIS_TICK_PROPS = {
  interval: "preserveStartEnd",
  minTickGap: 96,
} as const;

export const CHART_SURFACE_PROPS = { accessibilityLayer: false } as const;

export const STATIC_SERIES_PROPS = { isAnimationActive: false } as const;
