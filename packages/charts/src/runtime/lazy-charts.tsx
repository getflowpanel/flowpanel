"use client";
import type {
  AreaChartOptions,
  BarChartOptions,
  LineChartOptions,
  PieChartOptions,
} from "@flowpanel/core";
import { useLabels } from "@flowpanel/react";
import { Component, type ReactNode, Suspense, useEffect, useState } from "react";
import { ChartEmptyState } from "./ChartEmptyState";
import { ChartSkeleton } from "./ChartSkeleton";
import { DEFAULT_CHART_HEIGHT } from "./defaults";
import { ChartBody } from "./lazy-body";
import type { ChartRendererProps } from "./render-chart";

type SeriesNames = Readonly<Record<string, string>> | undefined;

export interface SeriesChartProps<Options> {
  data: unknown[];
  options: Options;
  names?: SeriesNames;
}

function ChartFailed() {
  const { errors } = useLabels();
  return (
    <p role="alert" className="fp-px-1 fp-text-sm fp-text-soft">
      {errors.network}
    </p>
  );
}

/** Keeps a chart whose code or drawing failed to one line, on a host's own page as inside the admin. */
class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  override render(): ReactNode {
    return this.state.failed ? <ChartFailed /> : this.props.children;
  }
}

function LazyChart({
  kind,
  data,
  options,
  names,
}: Pick<ChartRendererProps, "kind" | "data" | "options"> & { names?: SeriesNames }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (data.length === 0) return <ChartEmptyState />;
  const skeleton = <ChartSkeleton style={{ height: options.height ?? DEFAULT_CHART_HEIGHT }} />;
  if (!mounted) return skeleton;
  return (
    <ChartBoundary>
      <Suspense fallback={skeleton}>
        <ChartBody
          kind={kind}
          data={data}
          options={options}
          {...(names ? { seriesLabels: names } : {})}
        />
      </Suspense>
    </ChartBoundary>
  );
}

/** Each chart loads Recharts with the first chart a page draws, so importing it costs a page nothing. */
export function AreaChart(props: SeriesChartProps<AreaChartOptions>) {
  return <LazyChart kind="areaChart" {...props} />;
}

export function BarChart(props: SeriesChartProps<BarChartOptions>) {
  return <LazyChart kind="barChart" {...props} />;
}

export function LineChart(props: SeriesChartProps<LineChartOptions>) {
  return <LazyChart kind="lineChart" {...props} />;
}

export function PieChart({ data, options }: { data: unknown[]; options: PieChartOptions }) {
  return <LazyChart kind="pieChart" data={data} options={options} />;
}
