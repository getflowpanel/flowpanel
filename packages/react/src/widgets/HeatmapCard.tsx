"use client";
import type { WidgetCaption } from "@flowpanel/core";
import type { KeyboardEvent, ReactNode } from "react";
import { Card, CardContent } from "../layout/Card";
import { cn } from "../lib/cn";
import type { Tone } from "../lib/format";
import { CardHeading } from "./CardHeading";
import { EmptyLine } from "./EmptyLine";

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

const EMPTY = "fp-bg-fill";
const STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 };

/** Levels 1 to 4 shade the fill's own alpha, so a focus ring on the cell keeps full strength. */
const SHADES: Record<Tone, readonly [string, string, string, string]> = {
  default: ["fp-bg-data/30", "fp-bg-data/50", "fp-bg-data/75", "fp-bg-data"],
  accent: ["fp-bg-data/30", "fp-bg-data/50", "fp-bg-data/75", "fp-bg-data"],
  ok: ["fp-bg-ok/30", "fp-bg-ok/50", "fp-bg-ok/75", "fp-bg-ok"],
  warn: ["fp-bg-warn/30", "fp-bg-warn/50", "fp-bg-warn/75", "fp-bg-warn"],
  err: ["fp-bg-err/30", "fp-bg-err/50", "fp-bg-err/75", "fp-bg-err"],
  info: ["fp-bg-info/30", "fp-bg-info/50", "fp-bg-info/75", "fp-bg-info"],
  muted: ["fp-bg-faint/30", "fp-bg-faint/50", "fp-bg-faint/75", "fp-bg-faint"],
};

function shade(level: number, tone: Tone): string {
  return level === 0 ? EMPTY : (SHADES[tone][Math.min(level, 4) - 1] ?? EMPTY);
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
  if (!cell) return <span aria-hidden className="fp-h-3 fp-w-3" />;
  const box = cn("fp-block fp-h-3 fp-w-3 fp-rounded-[2px]", shade(cell.level, tone));
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
        "focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
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
    <Card className="fp-h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("fp-space-y-2", label || caption ? "fp-pt-0" : "")}>
        <p className="fp-text-xs fp-text-faint" aria-hidden={emptyState ? undefined : true}>
          {summary}
        </p>
        {emptyState ? (
          <EmptyLine>{emptyState}</EmptyLine>
        ) : (
          <div className="fp-overflow-x-auto">
            <div className="fp-inline-flex fp-gap-1">
              <div className="fp-grid fp-grid-rows-7 fp-gap-0.5 fp-pt-4 fp-text-[10px] fp-leading-3 fp-text-faint">
                {Array.from({ length: 7 }, (_, row) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: weekday rows are positional
                  <span key={row}>{weekdays.find((w) => w.row === row)?.label ?? ""}</span>
                ))}
              </div>
              <div>
                <div className="fp-flex fp-h-4 fp-gap-0.5 fp-text-[10px] fp-leading-3 fp-text-faint">
                  {weeks.map((_, index) => (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: week columns are positional
                      key={index}
                      className="fp-w-3 fp-overflow-visible fp-whitespace-nowrap"
                    >
                      {months.find((month) => month.index === index)?.label ?? ""}
                    </span>
                  ))}
                </div>
                {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole lint/a11y/noStaticElementInteractions: the role is "group" or "img", which Biome cannot resolve through the ternary. */}
                <div
                  role={stop ? "group" : "img"}
                  aria-label={summary}
                  className="fp-grid fp-grid-flow-col fp-grid-rows-7 fp-gap-0.5"
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
            <div className="fp-mt-1 fp-flex fp-items-center fp-justify-end fp-gap-1 fp-text-[10px] fp-text-faint">
              <span>{legend.less}</span>
              {[0, 1, 2, 3, 4].map((level) => (
                <span
                  key={level}
                  aria-hidden
                  className={cn("fp-h-2.5 fp-w-2.5 fp-rounded-[2px]", shade(level, tone))}
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
