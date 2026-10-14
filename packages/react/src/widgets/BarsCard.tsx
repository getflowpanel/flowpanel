"use client";
import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { Card, CardContent } from "../layout/Card";
import { cn } from "../lib/cn";
import type { NumericFormat, Tone } from "../lib/format";
import { toneFillClass } from "../lib/tone-classes";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { BarTrail } from "./BarTrail";
import { barWidthClass, shareOfMax } from "./bar-width";
import { CardHeading } from "./CardHeading";
import type { GoodWhen } from "./delta";
import { EmptyLine } from "./EmptyLine";
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
    <Card className="fp-h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("fp-space-y-2.5", label || caption ? "fp-pt-0" : "")}>
        {rows.every((row) => row.value === 0) ? (
          <EmptyLine>{emptyState ?? widget.empty}</EmptyLine>
        ) : (
          rows.map((row, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are ranked and labels may repeat
            <div key={index} data-tone={row.tone} className="fp-space-y-1">
              <div className="fp-flex fp-items-baseline fp-justify-between fp-gap-3 fp-text-xs">
                <span
                  className={cn(TWO_LINES, "fp-min-w-0 fp-text-soft")}
                  {...fullTextTitle(row.label)}
                >
                  {row.href ? (
                    <a href={row.href} className="hover:fp-underline">
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
                  freshLabel={widget.fresh}
                />
              </div>
              <div className="fp-h-1.5 fp-w-full fp-overflow-hidden fp-rounded-full fp-bg-fill">
                <div
                  className={cn(
                    "fp-h-full fp-rounded-full",
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
