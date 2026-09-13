"use client";
import type * as React from "react";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { useFormatting } from "../_provider/FormattingContext";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat } from "../lib/format";
import { barWidthClass } from "./bar-width";

export interface FunnelCardStep {
  label: string;
  value: number;
  href?: string;
}

export interface FunnelCardProps {
  label?: string;
  steps: FunnelCardStep[];
  format?: NumericFormat;
  /** Rendered instead of the steps when `steps` is empty. */
  emptyState?: React.ReactNode;
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** Stages with their share of the first step and the drop-off from the one before. */
export function FunnelCard({ label, steps, format, emptyState }: FunnelCardProps) {
  const formatting = useFormatting();
  const top = steps[0]?.value ?? 0;
  return (
    <Card className="h-full">
      {label ? <CardHeader>{label}</CardHeader> : null}
      <CardContent className={cn("space-y-2.5", label ? "pt-0" : "")}>
        {steps.length === 0 ? (
          <p className="text-xs text-fp-text-3">{emptyState}</p>
        ) : (
          steps.map((step, index) => {
            const share = top > 0 ? step.value / top : 0;
            const previous = steps[index - 1]?.value;
            const dropOff =
              previous !== undefined && previous > 0 ? (previous - step.value) / previous : null;
            return (
              <div key={step.label} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate text-fp-text-2">
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
                    <span className="text-fp-text-3">{percent(share)}</span>
                    {dropOff !== null ? (
                      <span className="text-fp-err-text">{`−${percent(dropOff)}`}</span>
                    ) : null}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-fp-bg-3">
                  <div className={cn("h-full rounded-full bg-fp-accent", barWidthClass(share))} />
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
