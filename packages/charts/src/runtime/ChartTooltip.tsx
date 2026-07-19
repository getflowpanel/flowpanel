"use client";
import { formatNumber, type NumericFormat } from "@flowpanel/react";
import type { ReactNode } from "react";

interface TooltipEntry {
  name?: ReactNode;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: ReactNode;
  format?: NumericFormat | undefined;
  /** Drops the header row — for sparkline-sized charts where it is noise. */
  compact?: boolean;
}

const show = (value: number | string | undefined, format: NumericFormat | undefined): string => {
  if (value === undefined || value === null) return "—";
  return typeof value === "number" ? formatNumber(value, format) : String(value);
};

/**
 * Two-column tooltip: series on the left, value hard-right. Recharts' built-in
 * renderer inlines the value after the name, so numbers of different widths
 * never line up and the panel cannot be scanned down its right edge.
 */
export function ChartTooltip({ active, payload, label, format, compact }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((sum, p) => (typeof p.value === "number" ? sum + p.value : sum), 0);
  return (
    <div className="min-w-[9rem] rounded-fp-lg border border-fp-border-1 bg-fp-bg-1 px-3 py-2 text-xs shadow-fp-md">
      {compact ? null : (
        <div className="flex items-baseline justify-between gap-6 pb-1.5 font-medium text-fp-text-1">
          <span>{label}</span>
          {/* A total beside a single series would just print the same number twice. */}
          {payload.length > 1 ? <span className="tabular-nums">{show(total, format)}</span> : null}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((p) => (
          <div
            key={String(p.dataKey ?? p.name)}
            className="flex items-center justify-between gap-6"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-fp-text-2">
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ background: p.color }}
              />
              <span className="truncate">{p.name}</span>
            </span>
            <span className="shrink-0 tabular-nums font-medium text-fp-text-1">
              {show(p.value, format)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
