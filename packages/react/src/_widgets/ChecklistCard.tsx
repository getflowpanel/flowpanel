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
        "flex min-w-0 gap-2",
        steps && "rounded-md border border-fp-border-1 p-3 md:flex-1",
      )}
    >
      <span
        role="img"
        aria-label={item.mark}
        className={cn(
          "w-4 shrink-0 text-center text-sm leading-5",
          done ? toneTextClass[item.tone ?? "ok"] : "text-fp-text-3",
        )}
      >
        {MARK[item.state]}
      </span>
      <span className="min-w-0">
        <span
          className={cn("block break-words text-sm", done ? "text-fp-text-1" : "text-fp-text-3")}
        >
          {item.href ? (
            <a href={item.href} className="hover:underline">
              {item.label}
            </a>
          ) : (
            item.label
          )}
        </span>
        {when ? <span className="block text-xs tabular-nums text-fp-text-3">{when}</span> : null}
        {item.hint ? (
          <span className="block break-words text-xs text-fp-text-3">{item.hint}</span>
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
    <Card className="h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("space-y-3", label || caption ? "pt-0" : "")}>
        {summary ? (
          <div className="space-y-1">
            <p className="text-xs text-fp-text-3">{summary.text}</p>
            <div className="h-1 overflow-hidden rounded-full bg-fp-bg-3">
              <div
                data-share=""
                className={cn("h-full rounded-full bg-fp-ok", barWidthClass(summary.share))}
              />
            </div>
          </div>
        ) : null}
        {items.length === 0 ? (
          <EmptyLine>{emptyState}</EmptyLine>
        ) : (
          <ol className={cn("flex flex-col", steps ? "gap-3 md:flex-row" : "gap-2")}>
            {items.map((item) => (
              <Item key={item.key} item={item} steps={steps} />
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
