"use client";
import type { WidgetCaption } from "@flowpanel/core";
import { Card, CardContent } from "../_layout/Card";
import { useFormatting } from "../_provider/FormattingContext";
import { cn } from "../lib/cn";
import {
  formatDateValue,
  formatNumber,
  type NumericFormat,
  type ResolvedFormatting,
  type Tone,
} from "../lib/format";
import { LABEL_TEXT } from "../lib/label-text";
import { toneTextClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface StatGroupCardProps {
  label?: string;
  stats: Array<{
    label: string;
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
): string {
  if (typeof value === "number") return formatNumber(value, format, formatting);
  if (value instanceof Date) return formatDateValue(value, formatting);
  return String(value ?? "—");
}

export function StatGroupCard({ label, stats, caption }: StatGroupCardProps) {
  const formatting = useFormatting();
  return (
    <Card className="h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "pt-0" : ""}>
        <dl className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-x-4 gap-y-3">
          {stats.map((s, index) => {
            const text = statText(s.value, s.format, formatting);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: stats are ordered and labels may repeat
              <div key={index} data-tone={s.tone} className="min-w-0">
                <dt className={cn("break-words", LABEL_TEXT)}>{s.label}</dt>
                <dd
                  className={cn(
                    TWO_LINES,
                    "mt-0.5 min-w-0 text-base font-medium tabular-nums",
                    toneTextClass[s.tone ?? "default"],
                  )}
                  {...fullTextTitle(text)}
                >
                  {s.href ? (
                    <a href={s.href} className="hover:underline">
                      {text}
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
