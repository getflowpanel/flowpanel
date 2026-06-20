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
import {
  AXIS_TICK_PROPS,
  BAR_TOOLTIP_CURSOR,
  buildTooltipProps,
  buildValueTickFormatter,
  CHART_SURFACE_PROPS,
  chartColor,
  LEGEND_PROPS,
  STATIC_SERIES_PROPS,
} from "./chart-theme.js";
import { buildTickFormatter } from "./format-tick.js";

export function BarChart({ data, options }: { data: unknown[]; options: BarChartOptions }) {
  const ys = Array.isArray(options.y) ? options.y : [options.y];
  const multiSeries = ys.length > 1;
  const layout = options.horizontal ? "vertical" : "horizontal";
  const categoryTickFormatter = buildTickFormatter(
    data as Record<string, unknown>[],
    options.x,
    options.bucket,
  );
  const valueTickFormatter = buildValueTickFormatter(options.format);
  return (
    <ResponsiveContainer width="100%" height={options.height ?? 240}>
      <RcBar {...CHART_SURFACE_PROPS} data={data as object[]} layout={layout}>
        <CartesianGrid stroke="hsl(var(--fp-border-1))" strokeDasharray="3 3" />
        {options.horizontal ? (
          <>
            <XAxis
              type="number"
              stroke="hsl(var(--fp-text-3))"
              fontSize={12}
              {...(valueTickFormatter ? { tickFormatter: valueTickFormatter } : {})}
            />
            <YAxis
              type="category"
              dataKey={options.x}
              stroke="hsl(var(--fp-text-3))"
              fontSize={12}
              tickFormatter={categoryTickFormatter}
              {...AXIS_TICK_PROPS}
            />
          </>
        ) : (
          <>
            <XAxis
              dataKey={options.x}
              stroke="hsl(var(--fp-text-3))"
              fontSize={12}
              tickFormatter={categoryTickFormatter}
              {...AXIS_TICK_PROPS}
            />
            <YAxis
              stroke="hsl(var(--fp-text-3))"
              fontSize={12}
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
            {...STATIC_SERIES_PROPS}
          />
        ))}
      </RcBar>
    </ResponsiveContainer>
  );
}
