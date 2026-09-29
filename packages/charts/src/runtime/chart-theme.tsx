import { formatDurationCompact, type ResolvedFormatting } from "@flowpanel/core/format";
import { formatNumber, type NumericFormat } from "@flowpanel/react";
import { ChartTooltip } from "./ChartTooltip";

/** Number of --fp-chart-N palette tokens declared in admin.css. */
const CHART_TOKENS = 7;

/** Resolve the i-th palette color — token-driven, so it retunes per scheme. */
export function chartColor(i: number): string {
  return `hsl(var(--fp-chart-${(i % CHART_TOKENS) + 1}))`;
}

/** Each series' colour: its own from `colors`, else the data colour alone or the palette in order. */
export function seriesPaint(
  ys: readonly string[],
  colors: Readonly<Record<string, string>> | undefined,
): (i: number) => string {
  return (i) => colors?.[ys[i] ?? ""] ?? (ys.length > 1 ? chartColor(i) : "hsl(var(--fp-data))");
}

function legendLabel(value: unknown) {
  return <span style={{ color: "hsl(var(--fp-text-2))" }}>{String(value)}</span>;
}

/** Legend for multi-series charts: a coloured swatch, the name in secondary text. */
export const LEGEND_PROPS = {
  wrapperStyle: { fontSize: 12 },
  iconType: "circle",
  iconSize: 8,
  formatter: legendLabel,
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
  tick: { fill: "hsl(var(--fp-text-3))", fontSize: 12 },
} as const;

/** Hover dot for line/area series — ringed with the surface color. */
export const ACTIVE_DOT_PROPS = { r: 4, strokeWidth: 2, stroke: "hsl(var(--fp-bg-1))" } as const;

export function buildValueTickFormatter(
  format: NumericFormat | undefined,
  formatting: ResolvedFormatting,
): ((value: unknown) => string) | undefined {
  if (!format) return undefined;
  return (value) => {
    if (typeof value !== "number") return String(value);
    return format === "duration"
      ? formatDurationCompact(value, formatting)
      : formatNumber(value, format, formatting);
  };
}

/** Resolve the extra `<Tooltip>` props driven by `ChartOptionsBase.format` and `.tooltip`. */
export function buildTooltipProps(
  format: NumericFormat | undefined,
  tooltip: "default" | "compact" | false | undefined,
  formatting: ResolvedFormatting,
) {
  return {
    content: (
      <ChartTooltip format={format} compact={tooltip === "compact"} formatting={formatting} />
    ),
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

/** Recharts drops ticks to satisfy `minTickGap`, so a narrow chart's axis thins out on its own. */
export const AXIS_TICK_PROPS = {
  interval: "preserveStartEnd",
  minTickGap: 96,
} as const;

export const CHART_SURFACE_PROPS = { accessibilityLayer: false } as const;

export const STATIC_SERIES_PROPS = { isAnimationActive: false } as const;
