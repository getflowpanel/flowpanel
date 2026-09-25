import type { WidgetCaption } from "@flowpanel/core";
import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneFillClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";

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
  emptyState: string;
  newest?: { href: string; label: string };
  older?: { href: string; label: string };
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

function Head({ line }: { line: TimelineCardLine }) {
  return (
    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span
        aria-hidden
        className={cn(
          "inline-block h-2 w-2 shrink-0 rounded-full",
          toneFillClass[line.tone ?? "muted"],
        )}
      />
      <time
        dateTime={line.iso}
        title={line.stamp}
        className="shrink-0 text-xs tabular-nums text-fp-text-3"
      >
        {line.span ?? line.time}
      </time>
      <span className="min-w-0 break-words text-sm text-fp-text-1">
        {line.href ? (
          <a href={line.href} className="hover:underline">
            {line.title}
          </a>
        ) : (
          line.title
        )}
      </span>
      {line.folded ? <span className="text-xs text-fp-text-3">{line.folded}</span> : null}
      {line.meta ? (
        <span className="min-w-0 break-words text-xs text-fp-text-3">{line.meta}</span>
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
        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
          <Head line={line} />
        </summary>
        {line.items ? (
          <ul className="ml-1 mt-1 space-y-1 border-l border-fp-border-1 pl-3">
            {line.items.map((item) => (
              <Line key={item.key} line={item} />
            ))}
          </ul>
        ) : (
          <p className="ml-4 mt-1 whitespace-pre-wrap break-words text-xs text-fp-text-2">
            {line.body}
          </p>
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
    <Card className="h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("space-y-4", label || caption ? "pt-0" : "")}>
        {chips.length > 2 ? (
          <nav className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <a
                key={chip.key}
                href={chip.href}
                aria-current={chip.current ? "true" : undefined}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs",
                  chip.current
                    ? "border-fp-accent bg-fp-accent/10 text-fp-text-1"
                    : "border-fp-border-1 text-fp-text-2 hover:bg-fp-bg-2",
                )}
              >
                {chip.label}
              </a>
            ))}
          </nav>
        ) : null}
        {groups.length === 0 ? (
          <p className="text-xs text-fp-text-3">{emptyState}</p>
        ) : (
          groups.map((group) => (
            <section key={group.key} className="space-y-1.5">
              {group.label ? (
                <h3 className="flex items-baseline gap-2 text-xs font-medium text-fp-text-2">
                  <span>{group.label}</span>
                  <span className="font-normal text-fp-text-3">{group.count}</span>
                </h3>
              ) : null}
              <ul className="space-y-1">
                {group.lines.map((line) => (
                  <Line key={line.key} line={line} />
                ))}
              </ul>
            </section>
          ))
        )}
        {newest || older ? (
          <div className="flex justify-between gap-3 text-xs">
            {newest ? (
              <a href={newest.href} className="text-fp-accent hover:underline">
                {newest.label}
              </a>
            ) : (
              <span />
            )}
            {older ? (
              <a href={older.href} className="text-fp-accent hover:underline">
                {older.label}
              </a>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
