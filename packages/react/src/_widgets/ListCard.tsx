import type * as React from "react";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import type { Tone } from "../lib/format";

export interface ListCardRow {
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
            {rows.map((row) => (
              <li
                key={`${row.text}|${row.meta ?? ""}`}
                data-tone={row.tone}
                className="flex items-baseline justify-between gap-3 py-1.5 first:pt-0 last:pb-0"
              >
                <span className="min-w-0 truncate text-sm text-fp-text-1">
                  {row.href ? (
                    <a href={row.href} className="hover:underline">
                      {row.text}
                    </a>
                  ) : (
                    row.text
                  )}
                </span>
                {row.meta ? (
                  <span className="shrink-0 text-xs tabular-nums text-fp-text-3">{row.meta}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
