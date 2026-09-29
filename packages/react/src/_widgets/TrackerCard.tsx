import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneFillClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import { EmptyLine } from "./EmptyLine";
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

const fill = (tone: Tone): string => (tone === "muted" ? "bg-fp-bg-3" : toneFillClass[tone]);

/** Status over time, one row per key: a `tracker()` widget. */
export function TrackerCard({ label, rows, caption, emptyState }: TrackerCardProps) {
  return (
    <Card className="h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "pt-0" : ""}>
        {rows.length === 0 ? (
          <EmptyLine>{emptyState}</EmptyLine>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.key}
                data-tone={row.tone}
                className="flex flex-wrap items-center gap-x-3 gap-y-1"
              >
                <span className="flex w-full min-w-0 items-center gap-2 text-sm sm:w-40">
                  <span
                    aria-hidden
                    data-tone-dot=""
                    className={cn("h-2 w-2 shrink-0 rounded-full", fill(row.tone))}
                  />
                  <span className="truncate text-fp-text-1" {...fullTextTitle(row.label)}>
                    {row.href ? (
                      <a href={row.href} className="hover:underline">
                        {row.label}
                      </a>
                    ) : (
                      row.label
                    )}
                  </span>
                </span>
                <span className="flex h-5 min-w-0 flex-1 gap-0.5">
                  {row.cells.map((cell, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: blocks are the ordered buckets of one window
                      key={index}
                      {...(cell.title === ""
                        ? { "aria-hidden": true }
                        : { role: "img", "aria-label": cell.title, title: cell.title })}
                      data-tone={cell.tone}
                      className={cn("h-full min-w-0 flex-1 rounded-sm", fill(cell.tone))}
                    />
                  ))}
                </span>
                {row.summary ? (
                  <span
                    className="w-full shrink-0 truncate text-xs text-fp-text-3 sm:w-32"
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
