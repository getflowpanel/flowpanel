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
import { ChartEmptyState } from "./ChartEmptyState.js";
import {
  ACTIVE_DOT_PROPS,
  AXIS_STYLE_PROPS,
  AXIS_TICK_PROPS,
  buildTooltipProps,
  buildValueTickFormatter,
  CHART_SURFACE_PROPS,
  chartColor,
  GRID_PROPS,
  LEGEND_PROPS,
  LINE_TOOLTIP_CURSOR,
  STATIC_SERIES_PROPS,
} from "./chart-theme.js";
import { buildTickFormatter } from "./format-tick.js";

export function LineChart({ data, options }: { data: unknown[]; options: LineChartOptions }) {
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
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RcLine {...CHART_SURFACE_PROPS} data={data as object[]}>
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
          <Line
            key={y}
            type={options.smooth ? "monotone" : "linear"}
            dataKey={y}
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={options.markers ?? false}
            activeDot={{ ...ACTIVE_DOT_PROPS, fill: seriesColor(i) }}
            {...STATIC_SERIES_PROPS}
          />
        ))}
      </RcLine>
    </ResponsiveContainer>
  );
}
