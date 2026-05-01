import type { WidgetConfig } from "@flowpanel/core";
import { Card, CardHeader } from "@flowpanel/react";
import type { ReactNode } from "react";
import { AreaChart } from "./AreaChart.js";
import { BarChart } from "./BarChart.js";
import { LineChart } from "./LineChart.js";
import { PieChart } from "./PieChart.js";

type ChartWidget = Extract<WidgetConfig, { kind: `${string}Chart` }>;

export function renderChart(widget: ChartWidget, data: unknown[]) {
  let body: ReactNode;
  switch (widget.kind) {
    case "areaChart":
      body = <AreaChart data={data} options={widget.options} />;
      break;
    case "barChart":
      body = <BarChart data={data} options={widget.options} />;
      break;
    case "lineChart":
      body = <LineChart data={data} options={widget.options} />;
      break;
    case "pieChart":
      body = <PieChart data={data} options={widget.options} />;
      break;
  }
  return (
    <Card>
      <CardHeader>{widget.label}</CardHeader>
      <div className="p-3">{body}</div>
    </Card>
  );
}
