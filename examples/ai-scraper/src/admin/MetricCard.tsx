"use client";
import { formatNumber, type MetricCardProps, Sparkline } from "@flowpanel/kit/react";

const toneClass = {
  default: "text-fp-text-1",
  accent: "text-fp-accent",
  ok: "text-fp-ok-text",
  warn: "text-fp-text-1",
  err: "text-fp-err-text",
  info: "text-fp-info-text",
  muted: "text-fp-text-2",
} as const;

/** Compact metric treatment used by the demo to showcase a project-specific theme slot. */
export function MetricCard({
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
}: MetricCardProps) {
  const display = typeof value === "number" ? formatNumber(value, format) : value;
  const content = (
    <div
      data-tone={tone}
      className="h-full rounded-fp-lg border border-fp-border-1 bg-fp-bg-1 px-4 py-4 shadow-fp-xs"
    >
      <div className="flex items-center justify-between gap-2 text-xs text-fp-text-3">
        <span className="flex min-w-0 items-center gap-2">
          {tone === "warn" ? (
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-fp-warn" />
          ) : null}
          <span className="truncate">{label}</span>
        </span>
        {icon ? <span aria-hidden>{icon}</span> : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`truncate text-[1.75rem] font-semibold leading-none tracking-[-0.035em] tabular-nums ${toneClass[tone]}`}
            >
              {display}
            </span>
            {unit ? <span className="text-xs text-fp-text-3">{unit}</span> : null}
          </div>
          {sublabel ? <p className="mt-2 text-xs text-fp-text-3">{sublabel}</p> : null}
        </div>
        {sparkline && sparkline.length > 1 ? (
          <Sparkline values={sparkline} className="shrink-0 text-fp-accent" />
        ) : null}
      </div>
      {delta ? (
        <p
          className={`mt-1 text-xs tabular-nums ${delta.value >= 0 ? "text-fp-ok-text" : "text-fp-err-text"}`}
        >
          {delta.value >= 0 ? "+" : "−"}
          {Math.abs(delta.value * 100).toFixed(1)}% · {delta.vs}
        </p>
      ) : null}
    </div>
  );

  return drilldown ? (
    <a
      href={drilldown}
      aria-label={label}
      className="block h-full rounded-fp-lg transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-fp-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 motion-reduce:transform-none"
    >
      {content}
    </a>
  ) : (
    content
  );
}
