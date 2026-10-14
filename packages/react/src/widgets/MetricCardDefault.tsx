import type { MetricDelta, WidgetCaption } from "@flowpanel/core";
import type { ResolvedFormatting } from "@flowpanel/core/format";
import { DEFAULT_LABELS, formatLabel } from "@flowpanel/core/labels";
import type * as React from "react";
import { Sparkline } from "../atoms/Sparkline";
import { Card, CardContent, CardHeader } from "../layout/Card";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format";
import { toneTextClass } from "../lib/tone-classes";
import { CaptionLine } from "./CaptionLine";
import { deltaPrint, describeDelta, type GoodWhen, MOOD_TEXT, NEUTRAL_BAND } from "./delta";
import { FIGURE } from "./figure";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface MetricCardProps {
  label: string;
  value: number | string;
  format?: NumericFormat;
  /** Trails the value in muted type — "USD", "req/s". Not part of the number. */
  unit?: string;
  sublabel?: string;
  delta?: MetricDelta | null;
  /** Which direction of `delta` is good news; `"neutral"` never colours it. */
  goodWhen?: GoodWhen;
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
  /** A change from nothing in the compared period — injected by `MetricCard`. */
  freshLabel?: string;
  /** Shown instead of a change inside the neutral band — injected by `MetricCard`. */
  noChangeLabel?: string;
  /** The sparkline's accessible name — injected by `MetricCard`. */
  trendLabel?: string;
  /** The line under the label: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

interface DeltaLineProps {
  delta: MetricDelta;
  goodWhen: GoodWhen | undefined;
  value: number | string;
  format: NumericFormat | undefined;
  formatting: ResolvedFormatting | undefined;
  previousLabel: string | undefined;
  pointsLabel: string | undefined;
  freshLabel: string | undefined;
  noChangeLabel: string | undefined;
}

function DeltaLine({
  delta,
  goodWhen,
  value,
  format,
  formatting,
  previousLabel,
  pointsLabel,
  freshLabel,
  noChangeLabel,
}: DeltaLineProps) {
  const print = deltaPrint(format, formatting, pointsLabel, freshLabel);
  const view = describeDelta({ ...delta, goodWhen }, value, format, print);
  if (view === null || Math.abs(delta.value) < NEUTRAL_BAND) {
    return (
      <p data-delta="flat" className="fp-mt-1 fp-text-xs fp-text-faint">
        {noChangeLabel ?? DEFAULT_LABELS.widget.noChange} {delta.vs}
      </p>
    );
  }
  const previous =
    delta.previous === undefined
      ? null
      : formatLabel(previousLabel ?? DEFAULT_LABELS.widget.previous, {
          value: print.value(delta.previous),
        });
  return (
    <div className="fp-mt-1 fp-flex fp-flex-wrap fp-items-baseline fp-gap-x-2 fp-text-xs fp-tabular-nums">
      <span
        data-delta={view.mood}
        className={view.material ? MOOD_TEXT[view.mood] : MOOD_TEXT.flat}
      >
        {view.fresh ? view.text : `${view.text} ${delta.vs}`}
      </span>
      {previous ? <span className="fp-text-faint">{previous}</span> : null}
    </div>
  );
}

/** The registry default. Formatting and labels come in as props; only the caption's spoken tone reads the labels context. */
export function DefaultMetricCard(props: MetricCardProps) {
  const {
    label,
    value,
    format,
    unit,
    sublabel,
    delta,
    goodWhen,
    sparkline,
    tone = "default",
    drilldown,
    icon,
    plain,
    formatting,
    previousLabel,
    pointsLabel,
    freshLabel,
    noChangeLabel,
    trendLabel,
    caption,
  } = props;
  const display = typeof value === "number" ? formatNumber(value, format, formatting) : value;
  const body = (
    <>
      <CardHeader className="fp-flex fp-items-center fp-justify-between fp-pb-1">
        <span className="fp-min-w-0">
          <span
            className={cn("fp-block fp-text-sm fp-text-soft", TWO_LINES)}
            {...fullTextTitle(label)}
          >
            {label}
          </span>
          <CaptionLine caption={caption} />
        </span>
        {icon ? (
          <span className="fp-text-faint" aria-hidden>
            {icon}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="fp-pt-0">
        <div className="fp-flex fp-flex-wrap fp-items-end fp-justify-between fp-gap-x-3 fp-gap-y-2">
          <div className="fp-grow fp-basis-0 fp-max-w-full">
            <div className="fp-flex fp-items-baseline fp-gap-1.5 fp-whitespace-nowrap">
              <span className={cn("fp-min-w-0 fp-truncate", FIGURE, toneTextClass[tone])}>
                {display}
              </span>
              {unit ? <span className="fp-shrink-0 fp-text-sm fp-text-faint">{unit}</span> : null}
            </div>
            {sublabel ? (
              <div
                className={cn(TWO_LINES, "fp-mt-0.5 fp-text-xs fp-text-faint")}
                {...fullTextTitle(sublabel)}
              >
                {sublabel}
              </div>
            ) : null}
            {delta ? (
              <DeltaLine
                delta={delta}
                goodWhen={goodWhen}
                value={value}
                format={format}
                formatting={formatting}
                previousLabel={previousLabel}
                pointsLabel={pointsLabel}
                freshLabel={freshLabel}
                noChangeLabel={noChangeLabel}
              />
            ) : null}
          </div>
          {sparkline && sparkline.length > 1 ? (
            <Sparkline
              values={sparkline}
              width={96}
              height={32}
              fill="hsl(var(--fp-data) / 0.12)"
              className="fp-shrink-0 fp-text-data"
              {...(trendLabel ? { label: trendLabel } : {})}
            />
          ) : null}
        </div>
      </CardContent>
    </>
  );
  const card = plain ? (
    <div
      className="fp-h-full fp-w-full fp-bg-surface fp-transition-colors group-hover:fp-bg-canvas"
      data-tone={tone}
      data-plain=""
    >
      {body}
    </div>
  ) : (
    <Card className="fp-h-full fp-w-full" data-tone={tone}>
      {body}
    </Card>
  );
  if (drilldown) {
    return (
      <a
        href={drilldown}
        className={cn(
          "fp-group fp-block fp-h-full fp-w-full focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
          plain
            ? "focus-visible:fp-ring-inset"
            : "fp-rounded-lg fp-transition-shadow hover:fp-shadow-sm",
        )}
        aria-label={label}
      >
        {card}
      </a>
    );
  }
  return card;
}
