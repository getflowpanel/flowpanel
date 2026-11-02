"use client";
import { AreaChart } from "./AreaChart";
import { BarChart } from "./BarChart";
import { LineChart } from "./LineChart";
import { PieChart } from "./PieChart";
import type { ChartRendererProps } from "./render-chart";

/** The chart itself; the one module that reaches Recharts, so a page loads it only when it draws a chart. */
export default function ChartBody({ kind, options, data, seriesLabels }: ChartRendererProps) {
  switch (kind) {
    case "areaChart":
      return <AreaChart data={data} options={options as never} names={seriesLabels} />;
    case "barChart":
      return <BarChart data={data} options={options as never} names={seriesLabels} />;
    case "lineChart":
      return <LineChart data={data} options={options as never} names={seriesLabels} />;
    case "pieChart":
      return <PieChart data={data} options={options as never} />;
  }
}
