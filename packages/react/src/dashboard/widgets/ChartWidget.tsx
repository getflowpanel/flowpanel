"use client";

import type { ChartWidgetData, SerializedChartWidget } from "@flowpanel/core";
import { Skeleton } from "../../ui/skeleton";
import { cn } from "../../utils/cn";

export interface ChartWidgetProps {
  widget: SerializedChartWidget;
  data?: ChartWidgetData;
  loading?: boolean;
  error?: string;
}

/**
 * Lightweight SVG chart (bar by default, line/area with area-polygon).
 * No external charting lib — keeps bundle small. Works from ~50 up to 500 points.
 */
export function ChartWidget({ widget, data, loading, error }: ChartWidgetProps) {
  const color = widget.color ?? "hsl(var(--primary))";

  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">{widget.label}</h3>
          {widget.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{widget.description}</p>
          )}
        </div>
      </div>

      <div className="p-4">
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : loading || !data ? (
          <Skeleton className="h-40 w-full" />
        ) : data.buckets.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">No data</div>
        ) : (
          <ChartSvg buckets={data.buckets} kind={widget.kind} color={color} />
        )}
      </div>
    </div>
  );
}

function ChartSvg({
  buckets,
  kind,
  color,
}: {
  buckets: { label: string; value: number }[];
  kind: "bar" | "line" | "area";
  color: string;
}) {
  const W = 800;
  const H = 180;
  const pad = { top: 8, right: 8, bottom: 24, left: 8 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const max = Math.max(...buckets.map((b) => b.value), 1);
  const step = buckets.length > 0 ? innerW / buckets.length : 0;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      preserveAspectRatio="none"
      role="img"
      aria-label="Chart"
    >
      {kind === "bar" && (
        <g>
          {buckets.map((b, i) => {
            const h = Math.max((b.value / max) * innerH, 2);
            const x = pad.left + i * step + step * 0.15;
            const y = pad.top + innerH - h;
            const w = step * 0.7;
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                fill={color}
                rx={2}
                className={cn("transition-opacity hover:opacity-80")}
              >
                <title>{`${b.label}: ${b.value.toLocaleString()}`}</title>
              </rect>
            );
          })}
        </g>
      )}

      {(kind === "line" || kind === "area") && (
        <g>
          {(() => {
            const pts = buckets.map((b, i) => {
              const x = pad.left + i * step + step / 2;
              const y = pad.top + innerH - (b.value / max) * innerH;
              return `${x},${y}`;
            });
            const line = pts.join(" ");
            return (
              <>
                {kind === "area" && (
                  <polygon
                    points={`${pad.left},${pad.top + innerH} ${line} ${pad.left + buckets.length * step},${pad.top + innerH}`}
                    fill={color}
                    opacity={0.15}
                  />
                )}
                <polyline
                  points={line}
                  stroke={color}
                  fill="none"
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {buckets.map((b, i) => {
                  const x = pad.left + i * step + step / 2;
                  const y = pad.top + innerH - (b.value / max) * innerH;
                  return (
                    <circle key={i} cx={x} cy={y} r={2.5} fill={color}>
                      <title>{`${b.label}: ${b.value.toLocaleString()}`}</title>
                    </circle>
                  );
                })}
              </>
            );
          })()}
        </g>
      )}

      {/* Axis labels — show first/middle/last */}
      <g className="text-[10px] fill-muted-foreground">
        {buckets.length > 0 && (
          <>
            <text x={pad.left} y={H - 6} className="fill-current">
              {buckets[0]?.label}
            </text>
            {buckets.length > 2 && (
              <text
                x={pad.left + innerW / 2}
                y={H - 6}
                textAnchor="middle"
                className="fill-current"
              >
                {buckets[Math.floor(buckets.length / 2)]?.label}
              </text>
            )}
            <text x={pad.left + innerW} y={H - 6} textAnchor="end" className="fill-current">
              {buckets[buckets.length - 1]?.label}
            </text>
          </>
        )}
      </g>
    </svg>
  );
}
