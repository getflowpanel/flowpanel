import type { WidgetConfig } from "@flowpanel/core";
import { Card, CardHeader } from "@flowpanel/react";
import type { ReactNode } from "react";
import { AreaChart } from "./AreaChart";
import { BarChart } from "./BarChart";
import { LineChart } from "./LineChart";
import { PieChart } from "./PieChart";

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
  const card = (
    <Card>
      <CardHeader>{label}</CardHeader>
      <div className="p-3">{body}</div>
    </Card>
  );
  if (options.drilldown) {
    return (
      <a
        href={options.drilldown}
        className="block hover:opacity-90 transition-opacity"
        {...(label ? { "aria-label": label } : {})}
      >
        {card}
      </a>
    );
  }
  return card;
}
