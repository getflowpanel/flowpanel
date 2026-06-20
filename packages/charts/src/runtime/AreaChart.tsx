"use client";
import type { AreaChartOptions } from "@flowpanel/core";
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
import {
  AXIS_TICK_PROPS,
  buildTooltipProps,
  buildValueTickFormatter,
  CHART_SURFACE_PROPS,
  chartColor,
  chartColorAlpha,
  LEGEND_PROPS,
  LINE_TOOLTIP_CURSOR,
  STATIC_SERIES_PROPS,
} from "./chart-theme.js";
import { buildTickFormatter } from "./format-tick.js";

export function AreaChart({ data, options }: { data: unknown[]; options: AreaChartOptions }) {
  const ys = Array.isArray(options.y) ? options.y : [options.y];
  const multiSeries = ys.length > 1;
  const tickFormatter = buildTickFormatter(
    data as Record<string, unknown>[],
    options.x,
    options.bucket,
  );
  const valueTickFormatter = buildValueTickFormatter(options.format);
  return (
    <ResponsiveContainer width="100%" height={options.height ?? 240}>
      <RcArea {...CHART_SURFACE_PROPS} data={data as object[]}>
        <CartesianGrid stroke="hsl(var(--fp-border-1))" strokeDasharray="3 3" />
        <XAxis
          dataKey={options.x}
          stroke="hsl(var(--fp-text-3))"
          fontSize={12}
          tickFormatter={tickFormatter}
          {...AXIS_TICK_PROPS}
        />
        <YAxis
          stroke="hsl(var(--fp-text-3))"
          fontSize={12}
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
            stroke={multiSeries ? chartColor(i) : "hsl(var(--fp-accent))"}
            fill={multiSeries ? chartColorAlpha(i, 0.2) : "hsl(var(--fp-accent) / 0.2)"}
            strokeWidth={2}
            {...STATIC_SERIES_PROPS}
          />
        ))}
      </RcArea>
    </ResponsiveContainer>
  );
}
