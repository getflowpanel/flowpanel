"use client";
import type { AreaChartOptions } from "@flowpanel/core";
import { useFormatting } from "@flowpanel/react";
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
import { ChartEmptyState } from "./ChartEmptyState";
import {
  ACTIVE_DOT_PROPS,
  AXIS_STYLE_PROPS,
  AXIS_TICK_PROPS,
  buildTooltipProps,
  buildValueTickFormatter,
  CHART_SURFACE_PROPS,
  GRID_PROPS,
  LEGEND_PROPS,
  LINE_TOOLTIP_CURSOR,
  STATIC_SERIES_PROPS,
  seriesPaint,
} from "./chart-theme";
import { DEFAULT_CHART_HEIGHT } from "./defaults";
import { buildTickFormatter } from "./format-tick";
import { seriesKeys } from "./series-keys";

export function AreaChart({
  data,
  options,
  names,
}: {
  data: unknown[];
  options: AreaChartOptions;
  names?: Readonly<Record<string, string>> | undefined;
}) {
  const formatting = useFormatting();
  const height = options.height ?? DEFAULT_CHART_HEIGHT;
  if (data.length === 0) return <ChartEmptyState />;
  const ys = seriesKeys(options.y);
  const multiSeries = ys.length > 1;
  const tickFormatter = buildTickFormatter(
    data as Record<string, unknown>[],
    options.x,
    options.bucket,
    formatting,
  );
  const valueTickFormatter = buildValueTickFormatter(options.format, formatting);
  const seriesColor = seriesPaint(ys, options.colors);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RcArea {...CHART_SURFACE_PROPS} data={data as object[]}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey={options.x}
          {...AXIS_STYLE_PROPS}
          tickFormatter={tickFormatter}
          {...AXIS_TICK_PROPS}
        />
        <YAxis
          {...AXIS_STYLE_PROPS}
          width="auto"
          {...(valueTickFormatter ? { tickFormatter: valueTickFormatter } : {})}
        />
        {options.tooltip !== false ? (
          <Tooltip
            cursor={LINE_TOOLTIP_CURSOR}
            {...buildTooltipProps(options.format, options.tooltip, formatting)}
          />
        ) : null}
        {multiSeries ? <Legend {...LEGEND_PROPS} /> : null}
        {ys.map((y, i) => (
          <Area
            key={y}
            type={options.smooth ? "monotone" : "linear"}
            dataKey={y}
            name={names?.[y] ?? y}
            {...(options.stacked ? { stackId: "a" } : {})}
            stroke={seriesColor(i)}
            fill={seriesColor(i)}
            fillOpacity={0.1}
            strokeWidth={1.75}
            activeDot={{ ...ACTIVE_DOT_PROPS, fill: seriesColor(i) }}
            {...STATIC_SERIES_PROPS}
          />
        ))}
      </RcArea>
    </ResponsiveContainer>
  );
}
