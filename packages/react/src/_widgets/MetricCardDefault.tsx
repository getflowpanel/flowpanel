import type * as React from "react";
import { Sparkline } from "../_atoms/Sparkline.js";
import { Card, CardContent, CardHeader } from "../_layout/Card.js";
import { cn } from "../lib/cn.js";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format.js";

export interface MetricCardProps {
  label: string;
  value: number | string;
  format?: NumericFormat;
  /** Trails the value in muted type — "USD", "req/s". Not part of the number. */
  unit?: string;
  sublabel?: string;
  delta?: { value: number; vs: string } | null;
  sparkline?: number[];
  tone?: Tone;
  drilldown?: string;
  icon?: React.ReactNode;
}

/** Pure renderer — no context dependency. Used as the registry default. */
export function DefaultMetricCard(props: MetricCardProps) {
  const {
    label,
    value,
    format,
    unit,
    sublabel,
    delta,
    sparkline,
    tone = "default",
    drilldown,
    icon,
  } = props;
  const display = typeof value === "number" ? formatNumber(value, format) : value;
  const body = (
    <>
      <CardHeader className="flex items-center justify-between pb-1">
        <span className="truncate text-sm text-fp-text-2">{label}</span>
        {icon ? (
          <span className="text-fp-text-3" aria-hidden>
            {icon}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="truncate text-[2rem] font-semibold leading-tight tracking-tight text-fp-text-1 tabular-nums">
                {display}
              </span>
              {unit ? <span className="shrink-0 text-sm text-fp-text-3">{unit}</span> : null}
            </div>
            {sublabel ? <div className="mt-0.5 text-xs text-fp-text-3">{sublabel}</div> : null}
            {delta ? (
              <div
                className={cn(
                  "mt-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
                  delta.value >= 0
                    ? "bg-fp-ok/10 text-fp-ok-text"
                    : "bg-fp-err/10 text-fp-err-text",
                )}
              >
                {delta.value >= 0 ? "▲" : "▼"} {Math.abs(delta.value * 100).toFixed(1)}% ·{" "}
                {delta.vs}
              </div>
            ) : null}
          </div>
          {sparkline && sparkline.length > 1 ? (
            <Sparkline
              values={sparkline}
              width={96}
              height={32}
              fill="hsl(var(--fp-accent) / 0.12)"
              className="shrink-0 text-fp-accent"
            />
          ) : null}
        </div>
      </CardContent>
    </>
  );
  const card = <Card data-tone={tone}>{body}</Card>;
  if (drilldown) {
    return (
      <a
        href={drilldown}
        className="group block rounded-fp-lg transition-shadow hover:shadow-fp-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40"
        aria-label={label}
      >
        {card}
      </a>
    );
  }
  return card;
}
