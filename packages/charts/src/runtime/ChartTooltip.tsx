"use client";
import { DEFAULT_FORMATTING, type ResolvedFormatting } from "@flowpanel/core/format";
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
  /** Locale and currency, injected by the chart that owns the `useFormatting()` hook. */
  formatting?: ResolvedFormatting;
}

const show = (
  value: number | string | undefined,
  format: NumericFormat | undefined,
  formatting: ResolvedFormatting,
): string => {
  if (value === undefined || value === null) return "—";
  return typeof value === "number" ? formatNumber(value, format, formatting) : String(value);
};

/** Two-column tooltip, series left and value hard-right, so values of different widths still line up. */
export function ChartTooltip({
  active,
  payload,
  label,
  format,
  compact,
  formatting = DEFAULT_FORMATTING,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((sum, p) => (typeof p.value === "number" ? sum + p.value : sum), 0);
  return (
    <div className="fp-min-w-[9rem] fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-px-3 fp-py-2 fp-text-xs fp-shadow-md">
      {compact ? null : (
        <div className="fp-flex fp-items-baseline fp-justify-between fp-gap-6 fp-pb-1.5 fp-font-medium fp-text-ink">
          <span>{label}</span>
          {/* A total beside a single series would just print the same number twice. */}
          {payload.length > 1 ? (
            <span className="fp-tabular-nums">{show(total, format, formatting)}</span>
          ) : null}
        </div>
      )}
      <div className="fp-flex fp-flex-col fp-gap-1">
        {payload.map((p) => (
          <div
            key={String(p.dataKey ?? p.name)}
            className="fp-flex fp-items-center fp-justify-between fp-gap-6"
          >
            <span className="fp-flex fp-min-w-0 fp-items-center fp-gap-1.5 fp-text-soft">
              <span
                aria-hidden
                className="fp-h-2 fp-w-2 fp-shrink-0 fp-rounded-[2px]"
                style={{ background: p.color }}
              />
              <span className="fp-truncate">{p.name}</span>
            </span>
            <span className="fp-shrink-0 fp-tabular-nums fp-font-medium fp-text-ink">
              {show(p.value, format, formatting)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
