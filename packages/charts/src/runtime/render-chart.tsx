"use client";
import type { WidgetConfig } from "@flowpanel/core";
import { Card, CardHeader } from "@flowpanel/react";
import { type ReactNode, useEffect, useState } from "react";
import { AreaChart } from "./AreaChart";
import { BarChart } from "./BarChart";
import { ChartSkeleton } from "./ChartSkeleton";
import { DEFAULT_CHART_HEIGHT } from "./defaults";
import { LineChart } from "./LineChart";
import { PieChart } from "./PieChart";

type ChartWidget = Extract<WidgetConfig, { kind: `${string}Chart` }>;

export interface ChartRendererProps {
  kind: ChartWidget["kind"];
  label?: string;
  options: ChartWidget["options"];
  data: unknown[];
}

/**
 * Recharts measures its container, which the server has none of. Until the chart
 * mounts the card holds a skeleton of the same height, so the first paint is a
 * placeholder rather than an empty frame that collapses on hydration.
 */
export function chartBody(
  { kind, options, data }: ChartRendererProps,
  mounted: boolean,
): ReactNode {
  if (!mounted) return <ChartSkeleton height={options.height ?? DEFAULT_CHART_HEIGHT} />;
  switch (kind) {
    case "areaChart":
      return <AreaChart data={data} options={options as never} />;
    case "barChart":
      return <BarChart data={data} options={options as never} />;
    case "lineChart":
      return <LineChart data={data} options={options as never} />;
    case "pieChart":
      return <PieChart data={data} options={options as never} />;
  }
}

export function ChartRenderer(props: ChartRendererProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const card = (
    <Card>
      <CardHeader>{props.label}</CardHeader>
      <div className="p-3">{chartBody(props, mounted)}</div>
    </Card>
  );
  if (props.options.drilldown) {
    return (
      <a
        href={props.options.drilldown}
        className="block hover:opacity-90 transition-opacity"
        {...(props.label ? { "aria-label": props.label } : {})}
      >
        {card}
      </a>
    );
  }
  return card;
}
