"use client";

import type { DashboardData, SerializedWidget } from "@flowpanel/core";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";
import { cn } from "../utils/cn";
import { ChartWidget } from "./widgets/ChartWidget";
import { CustomWidget } from "./widgets/CustomWidget";
import { ListWidget } from "./widgets/ListWidget";
import { MetricWidget } from "./widgets/MetricWidget";

/**
 * Fetcher contract — pluggable so this package doesn't hard-depend on a
 * specific tRPC client build. Default is a plain `fetch` hitting the tRPC
 * endpoint; users who need auth cookies, session headers, or their own
 * tRPC client can pass `load` themselves.
 */
export type DashboardLoader = (signal: AbortSignal) => Promise<DashboardData>;

export interface DashboardPageProps {
  widgets: SerializedWidget[];
  /** tRPC base URL. Used to build the default loader; ignored if `load` is set. */
  baseUrl: string;
  /** Custom loader. Overrides the default fetch. */
  load?: DashboardLoader;
  /** Map of custom widget id → React component. */
  components?: Record<string, ComponentType<{ data: unknown; loading: boolean }>>;
  /** Refresh interval in ms. Default 30_000. Pass 0 to disable auto-refresh. */
  refreshIntervalMs?: number;
}

/**
 * Default loader: POST to `${baseUrl}/flowpanel.dashboard.data`.
 *
 * This is raw `fetch` on purpose — importing a full tRPC client here would
 * force a transitive peer dep on every consumer, even those who just want
 * to render a standalone dashboard page. The tRPC response envelope
 * (`{ result: { data } }`) is handled transparently so the caller sees
 * plain `DashboardData`.
 */
function defaultLoader(baseUrl: string): DashboardLoader {
  return async (signal) => {
    const res = await fetch(`${baseUrl}/flowpanel.dashboard.data`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      signal,
    });
    if (!res.ok) throw new Error(`Dashboard request failed: ${res.status}`);
    const json = (await res.json()) as { result?: { data?: DashboardData } } | DashboardData;
    return "result" in json && json.result?.data ? json.result.data : (json as DashboardData);
  };
}

export function DashboardPage({
  widgets,
  baseUrl,
  load,
  components,
  refreshIntervalMs = 30_000,
}: DashboardPageProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loader = load ?? defaultLoader(baseUrl);
    const controller = new AbortController();
    let cancelled = false;

    const tick = async () => {
      try {
        const payload = await loader(controller.signal);
        if (cancelled) return;
        setData(payload);
        setError(null);
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void tick();

    if (refreshIntervalMs > 0) {
      const interval = setInterval(() => void tick(), refreshIntervalMs);
      return () => {
        cancelled = true;
        controller.abort();
        clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [baseUrl, load, refreshIntervalMs]);

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
