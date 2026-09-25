import type { WidgetCaption } from "@flowpanel/core";
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
  emptyState?: string;
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
}

const OPACITY = [1, 0.3, 0.5, 0.75, 1];

function Cell({ cell, tone }: { cell: HeatmapCardCell | null; tone: Tone }) {
  if (!cell) return <span aria-hidden className="h-3 w-3" />;
  const fill = cell.level === 0 ? "bg-fp-bg-3" : toneFillClass[tone];
  const style = cell.level === 0 ? undefined : { opacity: OPACITY[cell.level] };
  const box = cn("block h-3 w-3 rounded-[2px]", fill);
  return cell.href ? (
    // biome-ignore lint/a11y/useAnchorContent: aria-label carries the accessible name; the box is a decorative fill.
    <a
      href={cell.href}
      title={cell.title}
      aria-label={cell.title}
      data-level={cell.level}
      className={box}
      style={style}
    />
  ) : (
    <span title={cell.title} data-level={cell.level} className={box} style={style} />
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
  const linked = weeks.some((week) => week.some((cell) => cell?.href));
  return (
    <Card className="h-full">
      <CardHeading label={label} caption={caption} />
      <CardContent className={cn("space-y-2", label || caption ? "pt-0" : "")}>
        <p className="text-xs text-fp-text-3">{summary}</p>
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
                {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: both "group" and "img" accept aria-label; Biome cannot resolve the ternary role. */}
                <div
                  role={linked ? "group" : "img"}
                  aria-label={summary}
                  className="grid grid-flow-col grid-rows-7 gap-0.5"
                >
                  {weeks.flatMap((week, w) =>
                    week.map((cell, d) => (
                      <Cell key={cell?.key ?? `empty-${w}-${d}`} cell={cell} tone={tone} />
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
                  className={cn(
                    "h-2.5 w-2.5 rounded-[2px]",
                    level === 0 ? "bg-fp-bg-3" : toneFillClass[tone],
                  )}
                  style={level === 0 ? undefined : { opacity: OPACITY[level] }}
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
