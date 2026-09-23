"use client";
import { Card, CardContent } from "../_layout/Card";
import { useFormatting } from "../_provider/FormattingContext";
import { cn } from "../lib/cn";
import { formatNumber, type NumericFormat, type Tone } from "../lib/format";
import { toneTextClass } from "../lib/tone-classes";
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
}

/** One number with a label — a `stat()` widget. */
export function StatCard({ label, value, format, hint, href, tone = "default" }: StatCardProps) {
  const formatting = useFormatting();
  const display = typeof value === "number" ? formatNumber(value, format, formatting) : value;
  const card = (
    <Card className="h-full w-full" data-tone={tone}>
      <CardContent className="space-y-1">
        <div className="truncate text-sm font-medium text-fp-text-2">{label}</div>
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
    </Card>
  );
  if (!href) return card;
  return (
    <a
      href={href}
      aria-label={label}
      className="block h-full w-full rounded-fp-lg transition-shadow hover:shadow-fp-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40"
    >
      {card}
    </a>
  );
}
