"use client";
import type * as React from "react";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { useFormatting } from "../_provider/FormattingContext";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format";
import { toneFillClass } from "../lib/tone-classes";
import { barWidthClass, shareOfMax } from "./bar-width";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

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
  /** The value a full bar stands for. Default: the largest row. */
  max?: number;
  /** Rendered instead of the bars when `rows` is empty. */
  emptyState?: React.ReactNode;
}

/** A ranked breakdown, as a `bars()` widget. Bars are sized against `max` or the largest row. */
export function BarsCard({ label, rows, format, max: fullBar, emptyState }: BarsCardProps) {
  const formatting = useFormatting();
  const max =
    fullBar !== undefined && fullBar > 0
      ? fullBar
      : rows.reduce((acc, row) => Math.max(acc, row.value), 0);
  return (
    <Card className="h-full">
      {label ? <CardHeader>{label}</CardHeader> : null}
      <CardContent className={cn("space-y-2.5", label ? "pt-0" : "")}>
        {rows.length === 0 ? (
          <p className="text-xs text-fp-text-3">{emptyState}</p>
        ) : (
          rows.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are ranked and labels may repeat
            <div key={index} data-tone={row.tone} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span
                  className={cn(TWO_LINES, "min-w-0 text-fp-text-2")}
                  {...fullTextTitle(row.label)}
                >
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
                    "h-full rounded-full",
                    toneFillClass[row.tone ?? "default"],
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
