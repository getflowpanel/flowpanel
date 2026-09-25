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
import { toneTextClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";

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
    <Card>
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "pt-0" : ""}>
        <dl className="grid grid-cols-2 gap-3">
          {stats.map((s, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stats are ordered and labels may repeat
            <div key={index} data-tone={s.tone}>
              <dt className="text-xs text-fp-text-3 uppercase tracking-wide">{s.label}</dt>
              <dd
                className={cn(
                  "mt-0.5 text-base font-medium tabular-nums",
                  toneTextClass[s.tone ?? "default"],
                )}
              >
                {s.href ? (
                  <a href={s.href} className="hover:underline">
                    {statText(s.value, s.format, formatting)}
                  </a>
                ) : (
                  statText(s.value, s.format, formatting)
                )}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
