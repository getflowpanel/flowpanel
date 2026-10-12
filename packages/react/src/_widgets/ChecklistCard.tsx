import type { WidgetCaption } from "@flowpanel/core";
import type { ReactNode } from "react";
import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneTextClass } from "../lib/tone-classes";
import { barWidthClass } from "./bar-width";
import { CardHeading } from "./CardHeading";
import { EmptyLine } from "./EmptyLine";

export interface ChecklistCardItem {
  key: string;
  label: string;
  /** `todo` is a required item not done; `optional` an optional one not done. */
  state: "done" | "todo" | "optional";
  /** The mark's name for a screen reader. */
  mark: string;
  hint?: string;
  /** The mark's color when done; `ok` by default. */
  tone?: Tone;
  href?: string;
  /** When it was done, already formatted. */
  date?: string;
  /** The time since the previous done step, `+5 min`. */
  gap?: string;
}

export interface ChecklistCardProps {
  label?: string;
  items: ChecklistCardItem[];
  /** `steps` lays the items out in a row from `md`. */
  layout?: "list" | "steps";
  /** "7 of 12" and the share done, from 0 to 1. */
  summary?: { text: string; share: number };
  /** Shown instead of the items when there are none. */
  emptyState?: ReactNode;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

const MARK = { done: "✓", todo: "○", optional: "–" } as const;

function Item({ item, steps }: { item: ChecklistCardItem; steps: boolean }) {
  const done = item.state === "done";
  const when = [item.date, item.gap].filter(Boolean).join(" · ");
  return (
    <li
      data-state={item.state}
      className={cn(
        "fp-flex fp-min-w-0 fp-gap-2",
        steps && "fp-rounded-[0.375rem] fp-border fp-border-line fp-p-3 md:fp-flex-1",
      )}
    >
      <span
        role="img"
        aria-label={item.mark}
        className={cn(
          "fp-w-4 fp-shrink-0 fp-text-center fp-text-sm fp-leading-5",
          done ? toneTextClass[item.tone ?? "ok"] : "fp-text-faint",
        )}
      >
        {MARK[item.state]}
      </span>
      <span className="fp-min-w-0">
        <span
          className={cn(
            "fp-block fp-break-words fp-text-sm",
            done ? "fp-text-ink" : "fp-text-faint",
          )}
        >
          {item.href ? (
            <a href={item.href} className="hover:fp-underline">
              {item.label}
            </a>
          ) : (
            item.label
          )}
        </span>
        {when ? (
          <span className="fp-block fp-text-xs fp-tabular-nums fp-text-faint">{when}</span>
        ) : null}
        {item.hint ? (
          <span className="fp-block fp-break-words fp-text-xs fp-text-faint">{item.hint}</span>
        ) : null}
      </span>
    </li>
  );
}

/** What is done and what is not, as a `checklist()` widget: marks, dates, gaps and a summary bar. */
export function ChecklistCard({
  label,
  items,
  layout = "list",
  summary,
  emptyState,
  caption,
}: ChecklistCardProps) {
  const steps = layout === "steps";
  return (
    <Card className="fp-h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("fp-space-y-3", label || caption ? "fp-pt-0" : "")}>
        {summary ? (
          <div className="fp-space-y-1">
            <p className="fp-text-xs fp-text-faint">{summary.text}</p>
            <div className="fp-h-1 fp-overflow-hidden fp-rounded-full fp-bg-fill">
              <div
                data-share=""
                className={cn("fp-h-full fp-rounded-full fp-bg-ok", barWidthClass(summary.share))}
              />
            </div>
          </div>
        ) : null}
        {items.length === 0 ? (
          <EmptyLine>{emptyState}</EmptyLine>
        ) : (
          <ol className={cn("fp-flex fp-flex-col", steps ? "fp-gap-3 md:fp-flex-row" : "fp-gap-2")}>
            {items.map((item) => (
              <Item key={item.key} item={item} steps={steps} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
