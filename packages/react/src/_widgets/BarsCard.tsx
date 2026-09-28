"use client";
import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { Card, CardContent } from "../_layout/Card";
import { useFormatting } from "../_provider/FormattingContext";
import { useLabels } from "../_provider/LabelsContext";
import { cn } from "../lib/cn";
import type { NumericFormat, Tone } from "../lib/format";
import { toneFillClass } from "../lib/tone-classes";
import { BarTrail } from "./BarTrail";
import { barWidthClass, shareOfMax } from "./bar-width";
import { CardHeading } from "./CardHeading";
import type { GoodWhen } from "./delta";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface BarsCardRow {
  label: string;
  value: number;
  href?: string;
  tone?: Tone;
  /** The same row's value in the period before, for a change mark. */
  previous?: number;
  /** This row's part of the real total, 0 to 1. */
  share?: number;
}

export interface BarsCardProps {
  label?: string;
  rows: BarsCardRow[];
  format?: NumericFormat;
  /** The value a full bar stands for. Default: the largest row. */
  max?: number;
  /** Show each row's part of the total: its own share, else of the rows' sum. */
  share?: boolean;
  /** Which direction of a row's change is good news. Default: "up". */
  goodWhen?: GoodWhen;
  /** Rendered instead of the bars when `rows` is empty. */
  emptyState?: React.ReactNode;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

/** A ranked breakdown, as a `bars()` widget. Bars are sized against `max` or the largest row. */
export function BarsCard({
  label,
  rows,
  format,
  max: fullBar,
  share,
  goodWhen,
  emptyState,
  caption,
}: BarsCardProps) {
  const formatting = useFormatting();
  const { widget } = useLabels();
  const max =
    fullBar !== undefined && fullBar > 0
      ? fullBar
      : rows.reduce((acc, row) => Math.max(acc, row.value), 0);
  const total = rows.reduce((acc, row) => acc + row.value, 0);
  return (
    <Card className="h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("space-y-2.5", label || caption ? "pt-0" : "")}>
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
                <BarTrail
                  value={row.value}
                  previous={row.previous}
                  share={
                    share ? (row.share ?? (total > 0 ? row.value / total : undefined)) : undefined
                  }
                  format={format}
                  goodWhen={goodWhen}
                  formatting={formatting}
                  pointsLabel={widget.points}
                />
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
