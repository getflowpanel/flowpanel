"use client";
import { formatNumber, type MetricCardProps, Sparkline } from "@flowpanel/kit/react";

const toneClass = {
  default: "text-fp-text-1",
  accent: "text-fp-accent",
  ok: "text-fp-ok-text",
  warn: "text-fp-warn-text",
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
    <div data-tone={tone} className="h-full border-l border-fp-border-2 px-3 py-1 sm:px-4">
      <div className="flex items-center justify-between gap-2 text-xs text-fp-text-3">
        <span className="truncate">{label}</span>
        {icon ? <span aria-hidden>{icon}</span> : null}
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`truncate text-2xl font-semibold leading-none tracking-tight tabular-nums ${toneClass[tone]}`}
            >
              {display}
            </span>
            {unit ? <span className="text-xs text-fp-text-3">{unit}</span> : null}
          </div>
          {sublabel ? <p className="mt-1 text-xs text-fp-text-3">{sublabel}</p> : null}
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
      className="block h-full rounded-fp-sm py-1 transition-colors hover:bg-fp-bg-3/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40"
    >
      {content}
    </a>
  ) : (
    content
  );
}
