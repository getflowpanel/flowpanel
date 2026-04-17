"use client";

import type { MetricWidgetData, SerializedMetricWidget } from "@flowpanel/core";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Skeleton } from "../../ui/skeleton";
import { cn } from "../../utils/cn";

export interface MetricWidgetProps {
  widget: SerializedMetricWidget;
  data?: MetricWidgetData;
  loading?: boolean;
  error?: string;
}

function formatValue(
  value: number | string | null,
  format?: string,
  prefix?: string,
  suffix?: string,
): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return `${prefix ?? ""}${value}${suffix ?? ""}`;

  switch (format) {
    case "money":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "bytes":
      return formatBytes(value);
    case "duration":
      return formatDuration(value);
    default:
      return `${prefix ?? ""}${value.toLocaleString()}${suffix ?? ""}`;
  }
}

function formatBytes(n: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

export function MetricWidget({ widget, data, loading, error }: MetricWidgetProps) {
  const trend = data?.trend;
  const TrendIcon =
    trend?.direction === "up" ? ArrowUpRight : trend?.direction === "down" ? ArrowDownRight : Minus;
  const trendColor =
    trend?.direction === "up"
      ? "text-green-500"
      : trend?.direction === "down"
        ? "text-red-500"
        : "text-muted-foreground";

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-accent/5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {widget.label}
        </span>
      </div>

      {error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : loading || !data ? (
        <>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-16" />
        </>
      ) : (
        <>
          <div className="text-2xl font-semibold tracking-tight">
            {formatValue(data.value, widget.format, widget.prefix, widget.suffix)}
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {data.sublabel ?? widget.description ?? ""}
            </span>
            {trend && (
              <span className={cn("inline-flex items-center gap-0.5 font-medium", trendColor)}>
                <TrendIcon className="h-3 w-3" aria-hidden="true" />
                {trend.deltaPercent !== undefined
                  ? `${trend.deltaPercent > 0 ? "+" : ""}${trend.deltaPercent.toFixed(1)}%`
                  : trend.delta > 0
                    ? `+${trend.delta}`
                    : trend.delta}
                {trend.period && (
                  <span className="text-muted-foreground font-normal ml-0.5">· {trend.period}</span>
                )}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
