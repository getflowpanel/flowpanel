"use client";
import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { LocalTime } from "../atoms/LocalTime";
import { Card, CardContent } from "../layout/Card";
import { cn } from "../lib/cn";
import {
  formatNumber,
  type NumericFormat,
  type ResolvedFormatting,
  type Tone,
} from "../lib/format";
import { INLINE_LINK, LABEL_TEXT } from "../lib/label-text";
import { toneTextClass } from "../lib/tone-classes";
import { useFormatting } from "../provider/FormattingContext";
import { CardHeading } from "./CardHeading";
import { isCardDate } from "./card-date";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface StatGroupCardProps {
  label?: string;
  stats: Array<{
    label: string;
    /** A `Date` or a `CardDate` renders as `LocalTime`, like a datetime column. */
    value: unknown;
    format?: NumericFormat;
    tone?: Tone;
    /** Renders the value as a link. */
    href?: string;
  }>;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

function statText(
  value: unknown,
  format: NumericFormat | undefined,
  formatting: ResolvedFormatting,
): React.ReactNode {
  if (value instanceof Date) return <LocalTime date={value} />;
  if (isCardDate(value)) return <LocalTime date={value.iso} />;
  if (typeof value === "number") return formatNumber(value, format, formatting);
  return String(value ?? "—");
}

export function StatGroupCard({ label, stats, caption }: StatGroupCardProps) {
  const formatting = useFormatting();
  return (
    <Card className="fp-h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "fp-pt-0" : ""}>
        <dl className="fp-grid fp-grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] fp-gap-x-4 fp-gap-y-3">
          {stats.map((s, index) => {
            const text = statText(s.value, s.format, formatting);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: stats are ordered and labels may repeat
              <div key={index} data-tone={s.tone} className="fp-min-w-0">
                <dt className={cn("fp-break-words", LABEL_TEXT)}>{s.label}</dt>
                <dd
                  className={cn(
                    s.href ? undefined : TWO_LINES,
                    "fp-mt-0.5 fp-min-w-0 fp-text-base fp-font-medium fp-tabular-nums",
                    toneTextClass[s.tone ?? "default"],
                  )}
                  {...fullTextTitle(text)}
                >
                  {s.href ? (
                    <a href={s.href} className={cn(INLINE_LINK, "fp-block")}>
                      <span className={TWO_LINES}>{text}</span>
                    </a>
                  ) : (
                    text
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </CardContent>
    </Card>
  );
}
