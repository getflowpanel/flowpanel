import type * as React from "react";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneFillClass, toneTextClass } from "../lib/tone-classes";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface ListCardRow {
  /** Stable identity for the row. Default: its position. */
  key?: string;
  text: string;
  /** Trailing detail — a timestamp, a count, an owner. */
  meta?: string;
  tone?: Tone;
  href?: string;
}

export interface ListCardProps {
  label?: string;
  rows: ListCardRow[];
  /** Rendered instead of the lines when `rows` is empty. */
  emptyState?: React.ReactNode;
}

function listTextClass(tone: Tone | undefined): string {
  return tone === "warn" || tone === "err" ? toneTextClass[tone] : "text-fp-text-1";
}

/** A short feed, as a `list()` widget. */
export function ListCard({ label, rows, emptyState }: ListCardProps) {
  return (
    <Card className="h-full">
      {label ? <CardHeader>{label}</CardHeader> : null}
      <CardContent className={label ? "pt-0" : ""}>
        {rows.length === 0 ? (
          <p className="text-xs text-fp-text-3">{emptyState}</p>
        ) : (
          <ul className="divide-y divide-fp-border-1">
            {rows.map((row, index) => (
              <li
                key={row.key ?? `#${index}`}
                data-tone={row.tone}
                className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0"
              >
                <span className="flex min-w-0 items-baseline gap-2">
                  {row.tone && row.tone !== "default" ? (
                    <span
                      aria-hidden
                      data-tone-dot=""
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 self-start rounded-full",
                        toneFillClass[row.tone],
                      )}
                    />
                  ) : null}
                  <span
                    className={cn(TWO_LINES, "min-w-0 text-sm", listTextClass(row.tone))}
                    {...fullTextTitle(row.text)}
                  >
                    {row.href ? (
                      <a href={row.href} className="hover:underline">
                        {row.text}
                      </a>
                    ) : (
                      row.text
                    )}
                  </span>
                </span>
                {row.meta ? (
                  <span
                    className={cn(
                      TWO_LINES,
                      "max-w-[45%] shrink-0 text-right text-xs tabular-nums text-fp-text-3",
                    )}
                    {...fullTextTitle(row.meta)}
                  >
                    {row.meta}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
