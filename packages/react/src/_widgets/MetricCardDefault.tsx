import type { MetricDelta, WidgetCaption } from "@flowpanel/core";
import type { ResolvedFormatting } from "@flowpanel/core/format";
import { DEFAULT_LABELS, formatLabel } from "@flowpanel/core/labels";
import type * as React from "react";
import { Sparkline } from "../_atoms/Sparkline";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format";
import { toneTextClass } from "../lib/tone-classes";
import { CaptionLine } from "./CaptionLine";
import { type DeltaMood, deltaPrint, describeDelta } from "./delta";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface MetricCardProps {
  label: string;
  value: number | string;
  format?: NumericFormat;
  /** Trails the value in muted type — "USD", "req/s". Not part of the number. */
  unit?: string;
  sublabel?: string;
  delta?: MetricDelta | null;
  sparkline?: number[];
  tone?: Tone;
  drilldown?: string;
  icon?: React.ReactNode;
  /** Drop the card frame, for a cell of a `StatStrip`. */
  plain?: boolean;
  /** Locale and currency, injected by `MetricCard` from `useFormatting()`. */
  formatting?: ResolvedFormatting;
  /** How the compared value reads, `{value}` filled — injected by `MetricCard` from the labels. */
  previousLabel?: string;
  /** How a rate's change in points reads, `{value}` filled — injected by `MetricCard`. */
  pointsLabel?: string;
  /** The line under the label: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

const MOOD_TEXT: Record<DeltaMood, string> = {
  good: "text-fp-ok-text",
  bad: "text-fp-err-text",
  flat: "text-fp-text-3",
};

interface DeltaLineProps {
  delta: MetricDelta;
  value: number | string;
  format: NumericFormat | undefined;
  formatting: ResolvedFormatting | undefined;
  previousLabel: string | undefined;
  pointsLabel: string | undefined;
}

function DeltaLine({
  delta,
  value,
  format,
  formatting,
  previousLabel,
  pointsLabel,
}: DeltaLineProps) {
  const print = deltaPrint(format, formatting, pointsLabel);
  const view = describeDelta(delta, value, format, print);
  const previous =
    delta.previous === undefined
      ? null
      : formatLabel(previousLabel ?? DEFAULT_LABELS.widget.previous, {
          value: print.value(delta.previous),
        });
  return (
    <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-xs tabular-nums">
      <span
        data-delta={view.mood}
        className={view.material ? MOOD_TEXT[view.mood] : MOOD_TEXT.flat}
      >
        {view.text} {delta.vs}
      </span>
      {previous ? <span className="text-fp-text-3">{previous}</span> : null}
    </div>
  );
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
    plain,
    formatting,
    previousLabel,
    pointsLabel,
    caption,
  } = props;
  const display = typeof value === "number" ? formatNumber(value, format, formatting) : value;
  const body = (
    <>
      <CardHeader className="flex items-center justify-between pb-1">
        <span className="min-w-0">
          <span className={cn("block text-sm text-fp-text-2", TWO_LINES)} {...fullTextTitle(label)}>
            {label}
          </span>
          <CaptionLine caption={caption} />
        </span>
        {icon ? (
          <span className="text-fp-text-3" aria-hidden>
            {icon}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
          <div className="grow basis-0 max-w-full">
            <div className="flex items-baseline gap-1.5 whitespace-nowrap">
              <span
                className={cn(
                  "min-w-0 truncate text-[2rem] font-semibold leading-tight tracking-tight tabular-nums",
                  toneTextClass[tone],
                )}
              >
                {display}
              </span>
              {unit ? <span className="shrink-0 text-sm text-fp-text-3">{unit}</span> : null}
            </div>
            {sublabel ? (
              <div
                className={cn(TWO_LINES, "mt-0.5 text-xs text-fp-text-3")}
                {...fullTextTitle(sublabel)}
              >
                {sublabel}
              </div>
            ) : null}
            {delta ? (
              <DeltaLine
                delta={delta}
                value={value}
                format={format}
                formatting={formatting}
                previousLabel={previousLabel}
                pointsLabel={pointsLabel}
              />
            ) : null}
          </div>
          {sparkline && sparkline.length > 1 ? (
            <Sparkline
              values={sparkline}
              width={96}
              height={32}
              fill="hsl(var(--fp-data) / 0.12)"
              className="shrink-0 text-fp-data"
            />
          ) : null}
        </div>
      </CardContent>
    </>
  );
  const card = plain ? (
    <div
      className="h-full w-full bg-fp-bg-1 transition-colors group-hover:bg-fp-bg-2"
      data-tone={tone}
      data-plain=""
    >
      {body}
    </div>
  ) : (
    <Card className="h-full w-full" data-tone={tone}>
      {body}
    </Card>
  );
  if (drilldown) {
    return (
      <a
        href={drilldown}
        className={cn(
          "group block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/60",
          plain ? "focus-visible:ring-inset" : "rounded-fp-lg transition-shadow hover:shadow-fp-sm",
        )}
        aria-label={label}
      >
        {card}
      </a>
    );
  }
  return card;
}
