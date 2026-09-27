"use client";
import type { WidgetCaption } from "@flowpanel/core";
import type { KeyboardEvent, ReactNode } from "react";
import { Card, CardContent } from "../_layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { toneFillClass } from "../lib/tone-classes";
import { CardHeading } from "./CardHeading";

export interface HeatmapCardCell {
  key: string;
  /** 0 for an empty day, 1 to 4 by quartile. */
  level: number;
  title: string;
  href?: string;
}

export interface HeatmapCardProps {
  label?: string;
  /** The totals in one sentence; the grid's accessible name. */
  summary: string;
  /** Weeks side by side, seven days each from the week's first day; `null` outside the period. */
  weeks: Array<Array<HeatmapCardCell | null>>;
  /** The week column where each month's label starts. */
  months: Array<{ index: number; label: string }>;
  /** The weekday labels, by row. */
  weekdays: Array<{ row: number; label: string }>;
  tone?: Tone;
  legend: { less: string; more: string };
  /** Shown instead of the grid when every day is empty. */
  emptyState?: ReactNode;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

const LEVEL = ["bg-fp-bg-3", "opacity-30", "opacity-50", "opacity-75", ""];
const STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };

function shade(level: number, tone: Tone): string {
  return level === 0 ? (LEVEL[0] as string) : cn(toneFillClass[tone], LEVEL[level]);
}

function moveBetweenDays(event: KeyboardEvent<HTMLDivElement>) {
  const step = STEP[event.key];
  const cells = [...event.currentTarget.children];
  const from = cells.indexOf(event.target as Element);
  const next = step === undefined || from < 0 ? undefined : cells[from + step];
  if (!(next instanceof HTMLAnchorElement)) return;
  event.preventDefault();
  (event.target as HTMLElement).tabIndex = -1;
  next.tabIndex = 0;
  next.focus();
}

function Cell({ cell, tone, stop }: { cell: HeatmapCardCell | null; tone: Tone; stop: boolean }) {
  if (!cell) return <span aria-hidden className="h-3 w-3" />;
  const box = cn("block h-3 w-3 rounded-[2px]", shade(cell.level, tone));
  return cell.href ? (
    // biome-ignore lint/a11y/useAnchorContent: aria-label carries the accessible name; the box is a decorative fill.
    <a
      href={cell.href}
      title={cell.title}
      aria-label={cell.title}
      data-level={cell.level}
      tabIndex={stop ? 0 : -1}
      className={cn(
        box,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/60",
      )}
    />
  ) : (
    <span title={cell.title} data-level={cell.level} className={box} />
  );
}

/** How often, day by day, as a `heatmap()` widget: weeks side by side, one shaded cell per day. */
export function HeatmapCard({
  label,
  summary,
  weeks,
  months,
  weekdays,
  tone = "accent",
  legend,
  emptyState,
  caption,
}: HeatmapCardProps) {
  const stop = weeks
    .flat()
    .reverse()
    .find((cell) => cell?.href)?.key;
  return (
    <Card className="h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("space-y-2", label || caption ? "pt-0" : "")}>
        <p className="text-xs text-fp-text-3" aria-hidden={emptyState ? undefined : true}>
          {summary}
        </p>
        {emptyState ? (
          <p className="text-xs text-fp-text-3">{emptyState}</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-flex gap-1">
              <div className="grid grid-rows-7 gap-0.5 pt-4 text-[10px] leading-3 text-fp-text-3">
                {Array.from({ length: 7 }, (_, row) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: weekday rows are positional
                  <span key={row}>{weekdays.find((w) => w.row === row)?.label ?? ""}</span>
                ))}
              </div>
              <div>
                <div className="flex h-4 gap-0.5 text-[10px] leading-3 text-fp-text-3">
                  {weeks.map((_, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: week columns are positional
                      key={index}
                      className="w-3 overflow-visible whitespace-nowrap"
                    >
                      {months.find((month) => month.index === index)?.label ?? ""}
                    </span>
                  ))}
                </div>
                {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole lint/a11y/noStaticElementInteractions: the role is "group" or "img", which Biome cannot resolve through the ternary. */}
                <div
                  role={stop ? "group" : "img"}
                  aria-label={summary}
                  className="grid grid-flow-col grid-rows-7 gap-0.5"
                  onKeyDown={stop ? moveBetweenDays : undefined}
                >
                  {weeks.flatMap((week, w) =>
                    week.map((cell, d) => (
                      <Cell
                        key={cell?.key ?? `empty-${w}-${d}`}
                        cell={cell}
                        tone={tone}
                        stop={cell !== null && cell.key === stop}
                      />
                    )),
                  )}
                </div>
              </div>
            </div>
            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-fp-text-3">
              <span>{legend.less}</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  aria-hidden
                  className={cn("h-2.5 w-2.5 rounded-[2px]", shade(level, tone))}
                />
              ))}
              <span>{legend.more}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
