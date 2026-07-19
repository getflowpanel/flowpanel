"use client";
import type { BarChartOptions } from "@flowpanel/core";
import {
  Bar,
  CartesianGrid,
  Legend,
  BarChart as RcBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartEmptyState } from "./ChartEmptyState.js";
import {
  AXIS_STYLE_PROPS,
  AXIS_TICK_PROPS,
  BAR_TOOLTIP_CURSOR,
  buildTooltipProps,
  buildValueTickFormatter,
  CHART_SURFACE_PROPS,
  chartColor,
  GRID_PROPS,
  LEGEND_PROPS,
  STATIC_SERIES_PROPS,
} from "./chart-theme.js";
import { buildTickFormatter } from "./format-tick.js";

export function BarChart({ data, options }: { data: unknown[]; options: BarChartOptions }) {
  const height = options.height ?? 240;
  if (data.length === 0) return <ChartEmptyState height={height} />;
  const ys = Array.isArray(options.y) ? options.y : [options.y];
  const multiSeries = ys.length > 1;
  const layout = options.horizontal ? "vertical" : "horizontal";
  const categoryTickFormatter = buildTickFormatter(
    data as Record<string, unknown>[],
    options.x,
    options.bucket,
  );
  const valueTickFormatter = buildValueTickFormatter(options.format);
  // Stacked bars only round the outer segment cleanly, so keep them square.
  const radius: [number, number, number, number] = options.stacked
    ? [0, 0, 0, 0]
    : options.horizontal
      ? [0, 4, 4, 0]
      : [4, 4, 0, 0];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RcBar {...CHART_SURFACE_PROPS} data={data as object[]} layout={layout}>
        <CartesianGrid
          {...GRID_PROPS}
          {...(options.horizontal ? { vertical: true, horizontal: false } : {})}
        />
        {options.horizontal ? (
          <>
            <XAxis
              type="number"
              {...AXIS_STYLE_PROPS}
              {...(valueTickFormatter ? { tickFormatter: valueTickFormatter } : {})}
            />
            <YAxis
              type="category"
              dataKey={options.x}
              {...AXIS_STYLE_PROPS}
              tickFormatter={categoryTickFormatter}
              {...AXIS_TICK_PROPS}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={options.x}
              {...AXIS_STYLE_PROPS}
              tickFormatter={categoryTickFormatter}
              {...AXIS_TICK_PROPS}
            />
            <YAxis
              {...AXIS_STYLE_PROPS}
              width={40}
              {...(valueTickFormatter ? { tickFormatter: valueTickFormatter } : {})}
            />
          </>
        )}
        {options.tooltip !== false ? (
          <Tooltip
            cursor={BAR_TOOLTIP_CURSOR}
            {...buildTooltipProps(options.format, options.tooltip)}
          />
        ) : null}
        {multiSeries ? <Legend {...LEGEND_PROPS} /> : null}
        {ys.map((y, i) => (
          <Bar
            key={y}
            dataKey={y}
            {...(options.stacked ? { stackId: "a" } : {})}
            fill={multiSeries ? chartColor(i) : "hsl(var(--fp-accent))"}
            radius={radius}
            maxBarSize={40}
            {...STATIC_SERIES_PROPS}
          />
        ))}
      </RcBar>
    </ResponsiveContainer>
  );
}
