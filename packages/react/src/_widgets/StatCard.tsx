"use client";
import type { WidgetCaption } from "@flowpanel/core";
import { Card, CardContent } from "../_layout/Card";
import { useFormatting } from "../_provider/FormattingContext";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format";
import { toneTextClass } from "../lib/tone-classes";
import { CaptionLine } from "./CaptionLine";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface StatCardProps {
  label: string;
  value: string | number;
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
  const display = typeof value === "number" ? formatNumber(value, format, formatting) : value;
  const content = (
    <CardContent className="space-y-1">
      <div
        className={cn("text-sm font-medium text-fp-text-2", TWO_LINES)}
        {...fullTextTitle(label)}
      >
        {label}
      </div>
      <CaptionLine caption={caption} />
      <div
        className={cn(
          "truncate text-xl font-semibold leading-tight tabular-nums",
          toneTextClass[tone],
        )}
      >
        {display}
      </div>
      {hint ? (
        <div className={cn(TWO_LINES, "text-xs text-fp-text-3")} {...fullTextTitle(hint)}>
          {hint}
        </div>
      ) : null}
    </CardContent>
  );
  const card = plain ? (
    <div
      className="h-full w-full bg-fp-bg-1 transition-colors group-hover:bg-fp-bg-2"
      data-tone={tone}
      data-plain=""
    >
      {content}
    </div>
  ) : (
    <Card className="h-full w-full" data-tone={tone}>
      {content}
    </Card>
  );
  if (!href) return card;
  return (
    <a
      href={href}
      aria-label={label}
      className={cn(
        "group block h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/60",
        plain ? "focus-visible:ring-inset" : "rounded-fp-lg transition-shadow hover:shadow-fp-sm",
      )}
    >
      {card}
    </a>
  );
}
