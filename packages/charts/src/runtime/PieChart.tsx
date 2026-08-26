"use client";
import type { PieChartOptions } from "@flowpanel/core";
import { Cell, Legend, Pie, PieChart as RcPie, ResponsiveContainer, Tooltip } from "recharts";
import { ChartEmptyState } from "./ChartEmptyState";
import {
  buildTooltipProps,
  CHART_SURFACE_PROPS,
  chartColor,
  LEGEND_PROPS,
  STATIC_SERIES_PROPS,
} from "./chart-theme";
import { DEFAULT_CHART_HEIGHT } from "./defaults";

export function PieChart({ data, options }: { data: unknown[]; options: PieChartOptions }) {
  const height = options.height ?? DEFAULT_CHART_HEIGHT;
  if (data.length === 0) return <ChartEmptyState height={height} />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RcPie {...CHART_SURFACE_PROPS}>
        {options.tooltip !== false ? (
          <Tooltip {...buildTooltipProps(options.format, options.tooltip)} />
        ) : null}
        {options.showLegend ? <Legend {...LEGEND_PROPS} /> : null}
        <Pie
          data={data as object[]}
          dataKey={options.value}
          nameKey={options.category}
          {...(options.donut ? { innerRadius: 60, paddingAngle: 2, cornerRadius: 3 } : {})}
          outerRadius={90}
          stroke="hsl(var(--fp-bg-1))"
          strokeWidth={2}
          {...STATIC_SERIES_PROPS}
        >
          {(data as Record<string, unknown>[]).map((row, i) => {
            const key = String(row[options.category] ?? "");
            const fill = options.colors?.[key] ?? chartColor(i);
            // biome-ignore lint/suspicious/noArrayIndexKey: chart slices are identified only by index.
            return <Cell key={i} fill={fill} />;
          })}
        </Pie>
      </RcPie>
    </ResponsiveContainer>
  );
}
