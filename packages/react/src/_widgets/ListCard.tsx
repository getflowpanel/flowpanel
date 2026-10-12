import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { QUIET_LINK } from "../lib/label-text";
import { toneFillClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import { EmptyLine } from "./EmptyLine";
import { ListBanner } from "./ListBanner";
import { ToneWord } from "./ToneWord";
import { fullTextTitle, TWO_LINES } from "./wrap-text";

export interface ListCardRow {
  /** Stable identity for the row. Default: its position. */
  key?: string;
  text: string;
  /** Trailing detail — a timestamp, a count, an owner. */
  meta?: string;
  tone?: Tone;
  href?: string;
  /** Impact, already formatted. */
  count?: string;
  /** When it started, already formatted. */
  since?: string;
}

export interface ListCardProps {
  label?: string;
  rows: ListCardRow[];
  /** Rendered instead of the lines when `rows` is empty. */
  emptyState?: React.ReactNode;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
  /** `"banner"`: the first row as a sentence, the rest as dot lines, a rule in the worst tone, `allClear` when empty. */
  variant?: "list" | "banner";
  /** A banner's line when there are no rows. */
  allClear?: string;
  /** The line that folds the rows past a limit. */
  more?: { label: string; href?: string };
}

/** A short feed, as a `list()` widget. */
export function ListCard(props: ListCardProps) {
  if (props.variant === "banner") return <ListBanner {...props} />;
  const { label, rows, emptyState, caption, more } = props;
  return (
    <Card className="fp-h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={label || caption ? "fp-pt-0" : ""}>
        {rows.length === 0 ? (
          <EmptyLine>{emptyState}</EmptyLine>
        ) : (
          <ul className="fp-divide-y fp-divide-line">
            {rows.map((row, index) => (
              <li
                key={row.key ?? `#${index}`}
                data-tone={row.tone}
                className="fp-flex fp-items-baseline fp-justify-between fp-gap-3 fp-py-1.5 first:fp-pt-0 last:fp-pb-0"
              >
                <span className="fp-flex fp-min-w-0 fp-items-baseline fp-gap-2">
                  {row.tone && row.tone !== "default" ? (
                    <span
                      aria-hidden
                      data-tone-dot=""
                      className={cn(
                        "fp-mt-1.5 fp-h-2 fp-w-2 fp-shrink-0 fp-self-start fp-rounded-full",
                        toneFillClass[row.tone],
                      )}
                    />
                  ) : null}
                  <ToneWord tone={row.tone} />
                  <span
                    className={cn(TWO_LINES, "fp-min-w-0 fp-text-sm fp-text-ink")}
                    {...fullTextTitle(row.text)}
                  >
                    {row.href ? (
                      <a href={row.href} className="hover:fp-underline">
                        {row.text}
                      </a>
                    ) : (
                      row.text
                    )}
                  </span>
                </span>
                {row.count || row.since || row.meta ? (
                  <span
                    className={cn(
                      TWO_LINES,
                      "fp-max-w-[45%] fp-shrink-0 fp-text-right fp-text-xs fp-tabular-nums fp-text-faint",
                    )}
                    {...fullTextTitle([row.count, row.since, row.meta].filter(Boolean).join(" · "))}
                  >
                    {[row.count, row.since, row.meta].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {more ? (
          <div className="fp-mt-2 fp-text-xs">
            {more.href ? (
              <a href={more.href} className={QUIET_LINK}>
                {more.label}
              </a>
            ) : (
              <span className="fp-text-faint">{more.label}</span>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
