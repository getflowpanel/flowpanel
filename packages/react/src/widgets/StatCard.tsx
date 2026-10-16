"use client";
import type { WidgetCaption } from "@flowpanel/core";
import { LocalTime } from "../atoms/LocalTime";
import { Card, CardContent } from "../layout/Card";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format";
import { toneTextClass } from "../lib/tone-classes";
import { useFormatting } from "../provider/FormattingContext";
import { CaptionLine } from "./CaptionLine";
import { type CardDate, isCardDate } from "./card-date";
import { FIGURE, figureSize } from "./figure";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface StatCardProps {
  label: string;
  /** A `CardDate` renders as `LocalTime`, like a datetime column. */
  value: string | number | CardDate;
  format?: NumericFormat;
  /** Small caption under the value. */
  hint?: string;
  /** Turns the whole card into a link. */
  href?: string;
  tone?: Tone;
  /** Drop the card frame, for a cell of a `StatStrip`. */
  plain?: boolean;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

/** One number with a label — a `stat()` widget. */
export function StatCard({
  label,
  value,
  format,
  hint,
  href,
  tone = "default",
  plain,
  caption,
}: StatCardProps) {
  const formatting = useFormatting();
  const display = isCardDate(value) ? (
    <LocalTime date={value.iso} />
  ) : typeof value === "number" ? (
    formatNumber(value, format, formatting)
  ) : (
    value
  );
  const content = (
    <CardContent>
      <div className="fp-width-container fp-space-y-1">
        <div className={cn("fp-text-sm fp-text-soft", TWO_LINES)} {...fullTextTitle(label)}>
          {label}
        </div>
        <CaptionLine caption={caption} />
        <div className={cn("fp-truncate", FIGURE, toneTextClass[tone])} style={figureSize(display)}>
          {display}
        </div>
      </div>
      {hint ? (
        <div
          className={cn(TWO_LINES, "fp-mt-0.5 fp-text-xs fp-text-faint")}
          {...fullTextTitle(hint)}
        >
          {hint}
        </div>
      ) : null}
    </CardContent>
  );
  const card = plain ? (
    <div
      className="fp-h-full fp-w-full fp-bg-surface fp-transition-colors group-hover:fp-bg-canvas"
      data-tone={tone}
      data-plain=""
    >
      {content}
    </div>
  ) : (
    <Card className="fp-h-full fp-w-full" data-tone={tone}>
      {content}
    </Card>
  );
  if (!href) return card;
  return (
    <a
      href={href}
      aria-label={label}
      className={cn(
        "fp-group fp-block fp-h-full fp-w-full focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
        plain
          ? "focus-visible:fp-ring-inset"
          : "fp-rounded-lg fp-transition-shadow hover:fp-shadow-sm",
      )}
    >
      {card}
    </a>
  );
}
