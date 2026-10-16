"use client";
import type { BarChartOptions } from "@flowpanel/core";
import { useFormatting } from "@flowpanel/react";
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
import { ChartEmptyState } from "./ChartEmptyState";
import {
  AXIS_STYLE_PROPS,
  AXIS_TICK_PROPS,
  BAR_TOOLTIP_CURSOR,
  buildTooltipProps,
  buildValueTickFormatter,
  CHART_SURFACE_PROPS,
  GRID_PROPS,
  LEGEND_PROPS,
  STATIC_SERIES_PROPS,
  seriesPaint,
} from "./chart-theme";
import { DEFAULT_CHART_HEIGHT } from "./defaults";
import { buildTickFormatter } from "./format-tick";
import { seriesKeys } from "./series-keys";

export function BarChart({
  data,
  options,
  names,
}: {
  data: unknown[];
  options: BarChartOptions;
  names?: Readonly<Record<string, string>> | undefined;
}) {
  const formatting = useFormatting();
  const height = options.height ?? DEFAULT_CHART_HEIGHT;
  if (data.length === 0) return <ChartEmptyState />;
  const ys = seriesKeys(options.y);
  const multiSeries = ys.length > 1;
  const seriesColor = seriesPaint(ys, options.colors);
  const layout = options.horizontal ? "vertical" : "horizontal";
  const categoryTickFormatter = buildTickFormatter(
    data as Record<string, unknown>[],
    options.x,
    options.bucket,
    formatting,
  );
  const valueTickFormatter = buildValueTickFormatter(options.format, formatting);
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
              width="auto"
              dataKey={options.x}
              {...AXIS_STYLE_PROPS}
              tickFormatter={categoryTickFormatter}
              {...AXIS_TICK_PROPS}
              interval={0}
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
              width="auto"
              {...(valueTickFormatter ? { tickFormatter: valueTickFormatter } : {})}
            />
          </>
        )}
        {options.tooltip !== false ? (
          <Tooltip
            cursor={BAR_TOOLTIP_CURSOR}
            {...buildTooltipProps(options.format, options.tooltip, formatting)}
          />
        ) : null}
        {multiSeries ? <Legend {...LEGEND_PROPS} /> : null}
        {ys.map((y, i) => (
          <Bar
            key={y}
            dataKey={y}
            name={names?.[y] ?? y}
            {...(options.stacked ? { stackId: "a" } : {})}
            fill={seriesColor(i)}
            radius={radius}
            maxBarSize={40}
            {...STATIC_SERIES_PROPS}
          />
        ))}
      </RcBar>
    </ResponsiveContainer>
  );
}
