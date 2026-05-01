import type * as React from "react";
import { Card, CardContent, CardHeader } from "../_layout/Card.js";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format.js";

export interface MetricCardProps {
  label: string;
  value: number | string;
  format?: NumericFormat;
  sublabel?: string;
  delta?: { value: number; vs: string } | null;
  sparkline?: number[];
  tone?: Tone;
  drilldown?: string;
  icon?: React.ReactNode;
}

export function MetricCard(props: MetricCardProps) {
  const { label, value, format, sublabel, delta, tone = "default", drilldown } = props;
  const display = typeof value === "number" ? formatNumber(value, format) : value;
  const body = (
    <>
      <CardHeader className="flex items-center justify-between">
        <span className="text-xs text-fp-text-2 uppercase tracking-wide">{label}</span>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-semibold text-fp-text-1 tabular-nums">{display}</div>
        {sublabel ? <div className="text-xs text-fp-text-3 mt-0.5">{sublabel}</div> : null}
        {delta ? (
          <div
            className={`text-xs mt-1 tabular-nums ${
              delta.value >= 0 ? "text-fp-ok" : "text-fp-err"
            }`}
          >
            {delta.value >= 0 ? "▲" : "▼"} {Math.abs(delta.value * 100).toFixed(1)}% · {delta.vs}
          </div>
        ) : null}
      </CardContent>
    </>
  );
  const card = <Card data-tone={tone}>{body}</Card>;
  if (drilldown) {
    return (
      <a href={drilldown} className="block hover:opacity-90 transition-opacity" aria-label={label}>
        {card}
      </a>
    );
  }
  return card;
}
