"use client";
import type { LineChartOptions } from "@flowpanel/core";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RcLine,
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
  LEGEND_PROPS,
  LINE_TOOLTIP_CURSOR,
  STATIC_SERIES_PROPS,
} from "./chart-theme.js";
import { buildTickFormatter } from "./format-tick.js";

export function LineChart({ data, options }: { data: unknown[]; options: LineChartOptions }) {
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
      <RcLine {...CHART_SURFACE_PROPS} data={data as object[]}>
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
          <Line
            key={y}
            type={options.smooth ? "monotone" : "linear"}
            dataKey={y}
            stroke={multiSeries ? chartColor(i) : "hsl(var(--fp-accent))"}
            strokeWidth={2}
            dot={options.markers ?? false}
            {...STATIC_SERIES_PROPS}
          />
        ))}
      </RcLine>
    </ResponsiveContainer>
  );
}
