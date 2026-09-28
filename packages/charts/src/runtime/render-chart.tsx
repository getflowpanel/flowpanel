"use client";
import type { WidgetCaption, WidgetConfig } from "@flowpanel/core";
import { CaptionLine, Card, CardHeader } from "@flowpanel/react";
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
  /** Legend and tooltip name per series key, resolved on the server. */
  seriesLabels?: Readonly<Record<string, string>>;
  /** The card's link, resolved on the server from the widget's `drilldown`. */
  drilldown?: string;
  /** The line under the title, computed on the server. */
  caption?: WidgetCaption;
}

/**
 * Recharts measures its container, which the server has none of. Until the chart
 * mounts the card holds a skeleton of the same height, so the first paint is a
 * placeholder rather than an empty frame that collapses on hydration.
 */
export function chartBody(
  { kind, options, data, seriesLabels }: ChartRendererProps,
  mounted: boolean,
): ReactNode {
  if (!mounted) return <ChartSkeleton height={options.height ?? DEFAULT_CHART_HEIGHT} />;
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

/** Wrap a chart card in its link when it has one. */
export function chartFrame(
  card: ReactNode,
  { label, drilldown }: Pick<ChartRendererProps, "label" | "drilldown">,
): ReactNode {
  if (!drilldown) return card;
  return (
    <a
      href={drilldown}
      className="block hover:opacity-90 transition-opacity"
      {...(label ? { "aria-label": label } : {})}
    >
      {card}
    </a>
  );
}

export function ChartRenderer(props: ChartRendererProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  return chartFrame(
    <Card>
      <CardHeader>
        {props.label}
        <CaptionLine caption={props.caption} />
      </CardHeader>
      <div className="p-3">{chartBody(props, mounted)}</div>
    </Card>,
    props,
  );
}
