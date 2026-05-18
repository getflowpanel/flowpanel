import type { WidgetConfig } from "@flowpanel/core";
import { Card, CardHeader } from "@flowpanel/react";
import type { ReactNode } from "react";
import { AreaChart } from "./AreaChart.js";
import { BarChart } from "./BarChart.js";
import { LineChart } from "./LineChart.js";
import { PieChart } from "./PieChart.js";

type ChartWidget = Extract<WidgetConfig, { kind: `${string}Chart` }>;

export interface ChartRendererProps {
  kind: ChartWidget["kind"];
  label?: string;
  options: ChartWidget["options"];
  data: unknown[];
}

export function ChartRenderer({ kind, label, options, data }: ChartRendererProps) {
  let body: ReactNode;
  switch (kind) {
    case "areaChart":
      body = <AreaChart data={data} options={options as never} />;
      break;
    case "barChart":
      body = <BarChart data={data} options={options as never} />;
      break;
    case "lineChart":
      body = <LineChart data={data} options={options as never} />;
      break;
    case "pieChart":
      body = <PieChart data={data} options={options as never} />;
      break;
  }
  return (
    <Card>
      <CardHeader>{label}</CardHeader>
      <div className="p-3">{body}</div>
    </Card>
  );
}
