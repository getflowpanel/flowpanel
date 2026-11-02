"use client";
import type { WidgetCaption } from "@flowpanel/core";
import { formatPercentValue } from "@flowpanel/core/format";
import type * as React from "react";
import { Card, CardContent } from "../layout/Card";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat } from "../lib/format";
import { INLINE_LINK } from "../lib/label-text";
import { toneFillClass, toneTextClass } from "../lib/tone-classes";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { barWidthClass } from "./bar-width";
import { CardHeading } from "./CardHeading";
import { EmptyLine } from "./EmptyLine";
import { ToneWord } from "./ToneWord";
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
  /** Share lost from the step before past which the worst drop is marked `warn`. Unset: no mark. */
  alertDrop?: number;
  /** Rendered instead of the steps when `steps` is empty. */
  emptyState?: React.ReactNode;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

const visibleDrop = (drop: number | null): drop is number =>
  drop !== null && Math.round(Math.abs(drop) * 100) !== 0;

/** Stages with their share of the first step and the drop-off from the one before. */
export function FunnelCard({
  label,
  steps,
  format,
  alertDrop,
  emptyState,
  caption,
}: FunnelCardProps) {
  const formatting = useFormatting();
  const { widget } = useLabels();
  const top = steps[0]?.value ?? 0;
  const drops = steps.map((step, index) => {
    const previous = steps[index - 1]?.value;
    return previous !== undefined && previous > 0 && step.value >= 0
      ? (previous - step.value) / previous
      : null;
  });
  const worst =
    alertDrop === undefined
      ? -1
      : drops.reduce<number>(
          (at, drop, index) =>
            drop !== null && drop > alertDrop && drop > (drops[at] ?? -1) ? index : at,
          -1,
        );
  return (
    <Card className="fp-h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("fp-space-y-2.5", label || caption ? "fp-pt-0" : "")}>
        {steps.every((step) => step.value === 0) ? (
          <EmptyLine>{emptyState ?? widget.empty}</EmptyLine>
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
                className="fp-space-y-1"
              >
                <div className="fp-flex fp-items-baseline fp-justify-between fp-gap-3 fp-text-xs">
                  <span
                    className={cn(step.href ? undefined : TWO_LINES, "fp-min-w-0 fp-text-soft")}
                    {...fullTextTitle(step.label)}
                  >
                    {step.href ? (
                      <a href={step.href} className={cn(INLINE_LINK, "fp-block")}>
                        <span className={TWO_LINES}>{step.label}</span>
                      </a>
                    ) : (
                      step.label
                    )}
                  </span>
                  <span className="fp-flex fp-shrink-0 fp-items-baseline fp-gap-2 fp-tabular-nums">
                    <span className="fp-text-ink">
                      {formatNumber(step.value, format, formatting)}
                    </span>
                    <span className="fp-text-faint">
                      {formatPercentValue(share, formatting, 0)}
                    </span>
                    {visibleDrop(dropOff) ? (
                      <span className={alert ? toneTextClass.warn : "fp-text-faint"}>
                        {alert ? <ToneWord tone="warn" /> : null}
                        {dropOff < 0
                          ? `+${formatPercentValue(-dropOff, formatting, 0)}`
                          : `−${formatPercentValue(dropOff, formatting, 0)}`}
                      </span>
                    ) : null}
                  </span>
                </div>
                <div className="fp-h-1.5 fp-w-full fp-overflow-hidden fp-rounded-full fp-bg-fill">
                  <div
                    className={cn(
                      "fp-h-full fp-rounded-full",
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
