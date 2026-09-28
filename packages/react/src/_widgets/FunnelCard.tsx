"use client";
import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { Card, CardContent } from "../_layout/Card";
import { useFormatting } from "../_provider/FormattingContext";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat } from "../lib/format";
import { formatPercent } from "../lib/percent";
import { toneFillClass, toneTextClass } from "../lib/tone-classes";
import { barWidthClass } from "./bar-width";
import { CardHeading } from "./CardHeading";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface FunnelCardStep {
  label: string;
  value: number;
  href?: string;
}

export interface FunnelCardProps {
  label?: string;
  steps: FunnelCardStep[];
  format?: NumericFormat;
  /** Share lost from the step before past which the worst drop is marked `warn`. Default `0.5`. */
  alertDrop?: number;
  /** Rendered instead of the steps when `steps` is empty. */
  emptyState?: React.ReactNode;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

/** Stages with their share of the first step and the drop-off from the one before. */
export function FunnelCard({
  label,
  steps,
  format,
  alertDrop = 0.5,
  emptyState,
  caption,
}: FunnelCardProps) {
  const formatting = useFormatting();
  const top = steps[0]?.value ?? 0;
  const drops = steps.map((step, index) => {
    const previous = steps[index - 1]?.value;
    return previous !== undefined && previous > 0 && step.value >= 0
      ? (previous - step.value) / previous
      : null;
  });
  const worst = drops.reduce<number>(
    (at, drop, index) =>
      drop !== null && drop > alertDrop && drop > (drops[at] ?? -1) ? index : at,
    -1,
  );
  return (
    <Card className="h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("space-y-2.5", label || caption ? "pt-0" : "")}>
        {steps.length === 0 ? (
          <p className="text-xs text-fp-text-3">{emptyState}</p>
        ) : (
          steps.map((step, index) => {
            const share = top > 0 ? step.value / top : 0;
            const dropOff = drops[index] ?? null;
            const alert = index === worst;
            return (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: steps are ordered and labels may repeat
                key={index}
                data-step=""
                {...(alert ? { "data-tone": "warn" } : {})}
                className="space-y-1"
              >
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span
                    className={cn(
                      TWO_LINES,
                      "min-w-0",
                      alert ? toneTextClass.warn : "text-fp-text-2",
                    )}
                    {...fullTextTitle(step.label)}
                  >
                    {step.href ? (
                      <a href={step.href} className="hover:underline">
                        {step.label}
                      </a>
                    ) : (
                      step.label
                    )}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                    <span className="text-fp-text-1">
                      {formatNumber(step.value, format, formatting)}
                    </span>
                    <span className="text-fp-text-3">{formatPercent(share, 0, formatting)}</span>
                    {dropOff === null ? null : dropOff < 0 ? (
                      <span className="text-fp-ok-text">{`+${formatPercent(-dropOff, 0, formatting)}`}</span>
                    ) : (
                      <span className="text-fp-err-text">{`−${formatPercent(dropOff, 0, formatting)}`}</span>
                    )}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-fp-bg-3">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      toneFillClass[alert ? "warn" : "default"],
                      barWidthClass(share),
                    )}
                  />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
