"use client";

import type { DashboardData, SerializedWidget } from "@flowpanel/core";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { ChartWidget } from "./widgets/ChartWidget";
import { CustomWidget } from "./widgets/CustomWidget";
import { ListWidget } from "./widgets/ListWidget";
import { MetricWidget } from "./widgets/MetricWidget";

export interface DashboardPageProps {
  widgets: SerializedWidget[];
  baseUrl: string;
  /** Map of custom widget id → React component. */
  components?: Record<string, ComponentType<{ data: unknown; loading: boolean }>>;
  /** Refresh interval in ms. Default 30_000. Pass 0 to disable auto-refresh. */
  refreshIntervalMs?: number;
}

export function DashboardPage({
  widgets,
  baseUrl,
  components,
  refreshIntervalMs = 30_000,
}: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await fetch(`${baseUrl}/flowpanel.dashboard.data`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const json = (await res.json()) as { result?: { data?: DashboardData } } | DashboardData;
        if (cancelled) return;
        const payload =
          "result" in json && json.result?.data ? json.result.data : (json as DashboardData);
        setData(payload);
        setError(null);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchData();

    if (refreshIntervalMs > 0) {
      const interval = setInterval(() => void fetchData(), refreshIntervalMs);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [baseUrl, refreshIntervalMs]);

  if (widgets.length === 0) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center text-center text-sm text-muted-foreground">
        <p className="mb-2 font-medium text-foreground">No dashboard widgets configured</p>
        <p>
          Pass a <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">dashboard</code>{" "}
          option to
          <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono ml-1">
            defineFlowPanel()
          </code>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Live overview of your system</p>
        </div>
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {widgets.map((widget) => {
          const span = widget.layout?.span ?? defaultSpan(widget.type);
          const widgetData = data?.widgets[widget.id];
          const isError = widgetData && widgetData.type === "error";

          return (
            <div
              key={widget.id}
              className={cn(
                "col-span-12",
                span === 3 && "md:col-span-6 lg:col-span-3",
                span === 4 && "md:col-span-6 lg:col-span-4",
                span === 6 && "md:col-span-6",
                span === 8 && "lg:col-span-8",
                span === 12 && "col-span-12",
                span === 1 && "md:col-span-1",
                span === 2 && "md:col-span-2",
              )}
            >
              {widget.type === "metric" && (
                <MetricWidget
                  widget={widget}
                  data={widgetData?.type === "metric" ? widgetData : undefined}
                  loading={loading}
                  error={isError ? widgetData.error : undefined}
                />
              )}
              {widget.type === "list" && (
                <ListWidget
                  widget={widget}
                  data={widgetData?.type === "list" ? widgetData : undefined}
                  loading={loading}
                  error={isError ? widgetData.error : undefined}
                />
              )}
              {widget.type === "chart" && (
                <ChartWidget
                  widget={widget}
                  data={widgetData?.type === "chart" ? widgetData : undefined}
                  loading={loading}
                  error={isError ? widgetData.error : undefined}
                />
              )}
              {widget.type === "custom" && (
                <CustomWidget
                  widget={widget}
                  data={widgetData?.type === "custom" ? widgetData : undefined}
                  loading={loading}
                  error={isError ? widgetData.error : undefined}
                  components={components}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function defaultSpan(type: SerializedWidget["type"]): number {
  switch (type) {
    case "metric":
      return 3;
    case "list":
      return 6;
    default:
      return 12;
  }
}
