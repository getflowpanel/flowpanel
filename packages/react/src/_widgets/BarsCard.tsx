"use client";
import type * as React from "react";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { useFormatting } from "../_provider/FormattingContext";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format";
import { barWidthClass, shareOfMax } from "./bar-width";

export interface BarsCardRow {
  label: string;
  value: number;
  href?: string;
  tone?: Tone;
}

export interface BarsCardProps {
  label?: string;
  rows: BarsCardRow[];
  format?: NumericFormat;
  /** Rendered instead of the bars when `rows` is empty. */
  emptyState?: React.ReactNode;
}

/** A ranked breakdown, as a `bars()` widget. Bars are sized against the largest row. */
export function BarsCard({ label, rows, format, emptyState }: BarsCardProps) {
  const formatting = useFormatting();
  const max = rows.reduce((acc, row) => Math.max(acc, row.value), 0);
  return (
    <Card className="h-full">
      {label ? <CardHeader>{label}</CardHeader> : null}
      <CardContent className={cn("space-y-2.5", label ? "pt-0" : "")}>
        {rows.length === 0 ? (
          <p className="text-xs text-fp-text-3">{emptyState}</p>
        ) : (
          rows.map((row) => (
            <div key={row.label} data-tone={row.tone} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="min-w-0 truncate text-fp-text-2">
                  {row.href ? (
                    <a href={row.href} className="hover:underline">
                      {row.label}
                    </a>
                  ) : (
                    row.label
                  )}
                </span>
                <span className="shrink-0 tabular-nums text-fp-text-1">
                  {formatNumber(row.value, format, formatting)}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-fp-bg-3">
                <div
                  className={cn(
                    "h-full rounded-full bg-fp-accent",
                    barWidthClass(shareOfMax(row.value, max)),
                  )}
                />
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
