"use client";
import type { PieChartOptions } from "@flowpanel/core";
import { Cell, Legend, Pie, PieChart as RcPie, ResponsiveContainer, Tooltip } from "recharts";
import {
  CHART_SURFACE_PROPS,
  chartColor,
  STATIC_SERIES_PROPS,
  TOOLTIP_CONTENT_STYLE,
} from "./chart-theme.js";

export function PieChart({ data, options }: { data: unknown[]; options: PieChartOptions }) {
  return (
    <ResponsiveContainer width="100%" height={options.height ?? 240}>
      <RcPie {...CHART_SURFACE_PROPS}>
        <Tooltip contentStyle={TOOLTIP_CONTENT_STYLE} />
        {options.showLegend ? <Legend /> : null}
        <Pie
          data={data as object[]}
          dataKey={options.value}
          nameKey={options.category}
          {...(options.donut ? { innerRadius: 60 } : {})}
          outerRadius={90}
          stroke="hsl(var(--fp-bg-1))"
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
