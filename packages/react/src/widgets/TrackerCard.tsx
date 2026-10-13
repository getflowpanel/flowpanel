import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { Card, CardContent } from "../layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneFillClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import { EmptyLine } from "./EmptyLine";
import { ToneWord } from "./ToneWord";
import { fullTextTitle } from "./wrap-text";

export interface TrackerCardCell {
  tone: Tone;
  /** Hover text and the block's accessible name. */
  title: string;
}

export interface TrackerCardRow {
  key: string;
  label: string;
  tone: Tone;
  cells: TrackerCardCell[];
  summary?: string;
  href?: string;
}

export interface TrackerCardProps {
  label?: string;
  rows: TrackerCardRow[];
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
  /** Rendered instead of the rows when there are none. */
  emptyState?: React.ReactNode;
}

const fill = (tone: Tone): string => (tone === "muted" ? "fp-bg-fill" : toneFillClass[tone]);

/** Status over time, one row per key: a `tracker()` widget. */
export function TrackerCard({ label, rows, caption, emptyState }: TrackerCardProps) {
  return (
    <Card className="fp-h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "fp-pt-0" : ""}>
        {rows.length === 0 ? (
          <EmptyLine>{emptyState}</EmptyLine>
        ) : (
          <ul className="fp-space-y-2">
            {rows.map((row) => (
              <li
                key={row.key}
                data-tone={row.tone}
                className="fp-flex fp-flex-wrap fp-items-center fp-gap-x-3 fp-gap-y-1"
              >
                <span className="fp-flex fp-w-full fp-min-w-0 fp-items-center fp-gap-2 fp-text-sm sm:fp-w-40">
                  <span
                    aria-hidden
                    data-tone-dot=""
                    className={cn("fp-h-2 fp-w-2 fp-shrink-0 fp-rounded-full", fill(row.tone))}
                  />
                  <span className="fp-truncate fp-text-ink" {...fullTextTitle(row.label)}>
                    <ToneWord tone={row.tone} />
                    {row.href ? (
                      <a href={row.href} className="hover:fp-underline">
                        {row.label}
                      </a>
                    ) : (
                      row.label
                    )}
                  </span>
                </span>
                <span className="fp-flex fp-h-5 fp-min-w-0 fp-flex-1 fp-gap-0.5">
                  {row.cells.map((cell, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: blocks are the ordered buckets of one window
                      key={index}
                      {...(cell.title === ""
                        ? { "aria-hidden": true }
                        : { role: "img", "aria-label": cell.title, title: cell.title })}
                      data-tone={cell.tone}
                      className={cn(
                        "fp-h-full fp-min-w-0 fp-flex-1 fp-rounded-[0.125rem]",
                        fill(cell.tone),
                      )}
                    />
                  ))}
                </span>
                {row.summary ? (
                  <span
                    className="fp-w-full fp-shrink-0 fp-truncate fp-text-xs fp-text-faint sm:fp-w-32"
                    {...fullTextTitle(row.summary)}
                  >
                    {row.summary}
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
