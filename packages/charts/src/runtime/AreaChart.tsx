"use client";
import type { AreaChartOptions } from "@flowpanel/core";
import { useId } from "react";
import {
  Area,
  CartesianGrid,
  Legend,
  AreaChart as RcArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmptyState } from "./ChartEmptyState.js";
import {
  ACTIVE_DOT_PROPS,
  AXIS_STYLE_PROPS,
  AXIS_TICK_PROPS,
  buildTooltipProps,
  buildValueTickFormatter,
  CHART_SURFACE_PROPS,
  chartColor,
  chartColorAlpha,
  GRID_PROPS,
  LEGEND_PROPS,
  LINE_TOOLTIP_CURSOR,
  STATIC_SERIES_PROPS,
} from "./chart-theme.js";
import { buildTickFormatter } from "./format-tick.js";

export function AreaChart({ data, options }: { data: unknown[]; options: AreaChartOptions }) {
  const gradientId = useId();
  const height = options.height ?? 240;
  if (data.length === 0) return <ChartEmptyState height={height} />;
  const ys = Array.isArray(options.y) ? options.y : [options.y];
  const multiSeries = ys.length > 1;
  const tickFormatter = buildTickFormatter(
    data as Record<string, unknown>[],
    options.x,
    options.bucket,
  );
  const valueTickFormatter = buildValueTickFormatter(options.format);
  const seriesColor = (i: number) => (multiSeries ? chartColor(i) : "hsl(var(--fp-accent))");
  const seriesFade = (i: number, a: number) =>
    multiSeries ? chartColorAlpha(i, a) : `hsl(var(--fp-accent) / ${a})`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RcArea {...CHART_SURFACE_PROPS} data={data as object[]}>
        <defs>
          {ys.map((y, i) => (
            <linearGradient key={y} id={`${gradientId}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={seriesFade(i, 0.28)} />
              <stop offset="100%" stopColor={seriesFade(i, 0.02)} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey={options.x}
          {...AXIS_STYLE_PROPS}
          tickFormatter={tickFormatter}
          {...AXIS_TICK_PROPS}
        />
        <YAxis
          {...AXIS_STYLE_PROPS}
          width={40}
          {...(valueTickFormatter ? { tickFormatter: valueTickFormatter } : {})}
        />
        {options.tooltip !== false ? (
          <Tooltip
            cursor={LINE_TOOLTIP_CURSOR}
            {...buildTooltipProps(options.format, options.tooltip)}
          />
        ) : null}
        {multiSeries ? <Legend {...LEGEND_PROPS} /> : null}
        {ys.map((y, i) => (
          <Area
            key={y}
            type={options.smooth ? "monotone" : "linear"}
            dataKey={y}
            {...(options.stacked ? { stackId: "a" } : {})}
            stroke={seriesColor(i)}
            fill={`url(#${gradientId}-${i})`}
            strokeWidth={2}
            activeDot={{ ...ACTIVE_DOT_PROPS, fill: seriesColor(i) }}
            {...STATIC_SERIES_PROPS}
          />
        ))}
      </RcArea>
    </ResponsiveContainer>
  );
}
