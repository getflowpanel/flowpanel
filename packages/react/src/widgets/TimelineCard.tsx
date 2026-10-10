import type { WidgetCaption } from "@flowpanel/core";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "../layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { QUIET_LINK } from "../lib/label-text";
import { toneFillClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";
import { EmptyLine } from "./EmptyLine";

export interface TimelineCardChip {
  key: string;
  label: string;
  href: string;
  current: boolean;
}

export interface TimelineCardLine {
  key: string;
  /** The clock, `09:12`. */
  time: string;
  /** The full date and time, for the tooltip. */
  stamp: string;
  iso: string;
  title: string;
  meta?: string;
  body?: string;
  tone?: Tone;
  href?: string;
  /** How many events a folded line holds, `×37`. */
  folded?: string;
  /** A folded line's first and last clock, `09:12–18:40`. */
  span?: string;
  items?: TimelineCardLine[];
}

export interface TimelineCardGroup {
  key: string;
  /** The day — `Today`, a date — or empty for one ungrouped list. */
  label: string;
  count: string;
  lines: TimelineCardLine[];
}

export interface TimelineCardProps {
  label?: string;
  chips: TimelineCardChip[];
  groups: TimelineCardGroup[];
  emptyState?: ReactNode;
  newest?: { href: string; label: string };
  older?: { href: string; label: string };
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

function Head({ line, expandable }: { line: TimelineCardLine; expandable?: boolean }) {
  return (
    <span className="fp-flex fp-min-w-0 fp-flex-wrap fp-items-baseline fp-gap-x-2 fp-gap-y-0.5">
      <span
        aria-hidden
        className={cn(
          "fp-inline-block fp-h-2 fp-w-2 fp-shrink-0 fp-rounded-full",
          toneFillClass[line.tone ?? "muted"],
        )}
      />
      <time
        dateTime={line.iso}
        title={line.stamp}
        className="fp-shrink-0 fp-text-xs fp-tabular-nums fp-text-faint"
      >
        {line.span ?? line.time}
      </time>
      <span className="fp-min-w-0 fp-break-words fp-text-sm fp-text-ink">
        {line.href && !expandable ? (
          <a href={line.href} className="hover:fp-underline">
            {line.title}
          </a>
        ) : (
          line.title
        )}
      </span>
      {line.folded ? <span className="fp-text-xs fp-text-faint">{line.folded}</span> : null}
      {line.meta ? (
        <span className="fp-min-w-0 fp-break-words fp-text-xs fp-text-faint">{line.meta}</span>
      ) : null}
      {expandable ? (
        <ChevronRight
          aria-hidden
          className="fp-h-3.5 fp-w-3.5 fp-shrink-0 fp-self-center fp-text-faint fp-transition-transform [details[open]>summary_&]:fp-rotate-90"
        />
      ) : null}
    </span>
  );
}

function Line({ line }: { line: TimelineCardLine }) {
  if (!line.items && !line.body) {
    return (
      <li>
        <Head line={line} />
      </li>
    );
  }
  return (
    <li>
      <details>
        <summary className="fp-flex fp-min-h-6 fp-cursor-pointer fp-list-none fp-items-center fp-rounded-sm focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 [&::-webkit-details-marker]:fp-hidden">
          <Head line={line} expandable />
        </summary>
        {line.items ? (
          <ul className="fp-ml-1 fp-mt-1 fp-space-y-1 fp-border-l fp-border-line fp-pl-3">
            {line.items.map((item) => (
              <Line key={item.key} line={item} />
            ))}
          </ul>
        ) : (
          <div className="fp-ml-4 fp-mt-1 fp-space-y-1 fp-text-xs">
            <p className="fp-whitespace-pre-wrap fp-break-words fp-text-soft">{line.body}</p>
            {line.href ? (
              <a href={line.href} className={cn("fp-inline-block", QUIET_LINK)}>
                {line.title}
              </a>
            ) : null}
          </div>
        )}
      </details>
    </li>
  );
}

/** What happened, grouped by day, as a `timeline()` widget: chips, lines and paging, all links. */
export function TimelineCard({
  label,
  chips,
  groups,
  emptyState,
  newest,
  older,
  caption,
}: TimelineCardProps) {
  return (
    <Card className="fp-h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("fp-space-y-4", label || caption ? "fp-pt-0" : "")}>
        {chips.length > 2 ? (
          // biome-ignore lint/a11y/useSemanticElements: filter links, not form fields; a nav would add a landmark per card
          <div
            role="group"
            {...(label ? { "aria-label": label } : {})}
            className="fp-flex fp-flex-wrap fp-gap-1.5"
          >
            {chips.map((chip) => (
              <a
                key={chip.key}
                href={chip.href}
                aria-current={chip.current ? "true" : undefined}
                className={cn(
                  "fp-rounded-full fp-border fp-px-2.5 fp-py-0.5 fp-text-xs",
                  chip.current
                    ? "fp-border-line-strong fp-bg-fill fp-text-ink"
                    : "fp-border-line fp-text-soft hover:fp-bg-canvas",
                )}
              >
                {chip.label}
              </a>
            ))}
          </div>
        ) : null}
        {groups.length === 0 ? (
          <EmptyLine>{emptyState}</EmptyLine>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="fp-space-y-1.5">
              {group.label ? (
                <h3 className="fp-flex fp-items-baseline fp-gap-2 fp-text-xs fp-font-medium fp-text-soft">
                  <span>{group.label}</span>
                  <span className="fp-font-normal fp-text-faint">{group.count}</span>
                </h3>
              ) : null}
              <ul className="fp-space-y-1">
                {group.lines.map((line) => (
                  <Line key={line.key} line={line} />
                ))}
              </ul>
            </section>
          ))
        )}
        {newest || older ? (
          <div className="fp-flex fp-justify-between fp-gap-3 fp-text-xs">
            {newest ? (
              <a href={newest.href} className={QUIET_LINK}>
                {newest.label}
              </a>
            ) : (
              <span />
            )}
            {older ? (
              <a href={older.href} className={QUIET_LINK}>
                {older.label}
              </a>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
