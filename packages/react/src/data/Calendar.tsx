"use client";
import * as React from "react";
import { cn } from "../lib/cn";
import { useFormatting } from "../provider/FormattingContext";

export interface CalendarRange {
  from: Date | null;
  to: Date | null;
}

/**
 * Local-calendar `YYYY-MM-DD`. `toISOString()` would render the UTC day, which
 * is the previous one for anybody west of Greenwich after 00:00 local.
 */
export function toISODate(d: Date): string {
  const month = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function fromISODate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Today on the admin's clock, `formatting.timeZone`, as a local-calendar date like the grid's days. */
export function todayIn(timeZone: string): Date {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone, dateStyle: "short" }).format(new Date());
  return fromISODate(day) ?? new Date();
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

const sameDay = (a: Date | null, b: Date | null) =>
  a != null &&
  b != null &&
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

interface WeekInfoLocale extends Intl.Locale {
  getWeekInfo?: () => { firstDay: number };
  weekInfo?: { firstDay: number };
}

/** Intl numbers days 1 (Mon) … 7 (Sun); `getWeekInfo` is missing on older engines. */
function firstWeekday(locale: string): number {
  try {
    const l = new Intl.Locale(locale) as WeekInfoLocale;
    return l.getWeekInfo?.().firstDay ?? l.weekInfo?.firstDay ?? 1;
  } catch {
    return 1;
  }
}

/** Always six weeks, so switching months never changes the popover's height. */
function monthGrid(month: Date, weekStart: number): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() - (weekStart % 7) + 7) % 7;
  const start = addDays(first, -offset);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/**
 * "Август 2026", not "август 2026 г." — `format()` returns a sentence fragment,
 * so the parts are recomposed as a title.
 */
export function monthTitle(d: Date, locale: string): string {
  const parts = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).formatToParts(d);
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
}

/** Ranges are built from the admin's today, read at click time, not at import time. */
export const RANGE_PRESETS: {
  key: "today" | "last7d" | "last30d" | "thisMonth" | "lastMonth";
  range: (today: Date) => CalendarRange;
}[] = [
  { key: "today", range: (today) => ({ from: today, to: today }) },
  { key: "last7d", range: (today) => ({ from: addDays(today, -6), to: today }) },
  { key: "last30d", range: (today) => ({ from: addDays(today, -29), to: today }) },
  {
    key: "thisMonth",
    range: (today) => ({ from: new Date(today.getFullYear(), today.getMonth(), 1), to: today }),
  },
  {
    key: "lastMonth",
    range: (today) => ({
      from: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      to: new Date(today.getFullYear(), today.getMonth(), 0),
    }),
  },
];

export interface CalendarProps {
  /** First day of the rendered month. */
  month: Date;
  range: CalendarRange;
  /** Endpoint being previewed while the range is half-open. */
  hovered?: Date | null;
  /** Roving tabstop — exactly one day across all rendered months is tabbable. */
  focused: Date;
  onSelect: (day: Date) => void;
  onHover?: (day: Date | null) => void;
  onKeyDown?: React.KeyboardEventHandler;
  locale?: string;
  label: string;
}

/** One month grid with range highlighting. Internal — `DateRangeFilter` owns the state. */
export function Calendar({
  month,
  range,
  hovered,
  focused,
  onSelect,
  onHover,
  onKeyDown,
  locale,
  label,
}: CalendarProps) {
  const loc = locale ?? "en-US";
  const weekStart = React.useMemo(() => firstWeekday(loc), [loc]);
  const days = React.useMemo(() => monthGrid(month, weekStart), [month, weekStart]);
  const weekdayFmt = React.useMemo(() => new Intl.DateTimeFormat(loc, { weekday: "short" }), [loc]);
  const dayFmt = React.useMemo(() => new Intl.DateTimeFormat(loc, { dateStyle: "long" }), [loc]);
  const today = todayIn(useFormatting().timeZone);

  // One listener per grid rather than 84 closures across two months: the day is read back off the cell.
  const dayFrom = (e: React.SyntheticEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-day]");
    return el?.dataset.day ? fromISODate(el.dataset.day) : null;
  };
  const handleClick = (e: React.MouseEvent) => {
    const d = dayFrom(e);
    if (d) onSelect(d);
  };
  // Bound to focus as well as hover, so arrowing through a half-open range previews the band too.
  const handleOver = onHover
    ? (e: React.MouseEvent | React.FocusEvent) => {
        const d = dayFrom(e);
        if (d) onHover(d);
      }
    : undefined;

  // A half-open range paints against the hovered day, so the band tracks the cursor.
  const end = range.to ?? (range.from && hovered && hovered >= range.from ? hovered : range.to);
  const start = range.from;

  return (
    <table
      className="fp-border-separate fp-border-spacing-0"
      aria-label={label}
      onClick={handleClick}
      onKeyDown={onKeyDown}
      onMouseOver={handleOver}
      onFocus={handleOver}
      onMouseLeave={() => onHover?.(null)}
    >
      <thead>
        <tr>
          {days.slice(0, 7).map((d) => (
            <th
              key={d.getDay()}
              scope="col"
              className="fp-pb-2 fp-text-center fp-text-xs fp-font-normal fp-text-faint"
            >
              {weekdayFmt.format(d)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 6 }, (_, w) => (
          <tr key={days[w * 7]?.toDateString()}>
            {days.slice(w * 7, w * 7 + 7).map((d) => {
              const outside = d.getMonth() !== month.getMonth();
              const isStart = sameDay(d, start);
              const isEnd = sameDay(d, end);
              const inRange = start != null && end != null && d > start && d < end;
              const selected = isStart || isEnd;
              const isToday = sameDay(d, today);
              const banded =
                inRange || (selected && start != null && end != null && !sameDay(start, end));
              return (
                <td
                  key={d.toDateString()}
                  data-day={outside ? undefined : toISODate(d)}
                  className={cn(
                    // The band lives on the cell, so it runs edge to edge between days.
                    "fp-p-0",
                    banded && "fp-bg-accent/10",
                    isStart && "fp-rounded-l-full",
                    isEnd && "fp-rounded-r-full",
                  )}
                >
                  <button
                    type="button"
                    tabIndex={sameDay(d, focused) && !outside ? 0 : -1}
                    aria-pressed={selected}
                    aria-label={dayFmt.format(d)}
                    className={cn(
                      "fp-h-10 fp-w-10 fp-rounded-full fp-text-sm fp-tabular-nums fp-transition-colors focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
                      outside ? "fp-text-faint/50" : "fp-text-ink",
                      !selected && "hover:fp-bg-fill",
                      selected &&
                        "fp-bg-accent fp-font-medium fp-text-on-accent hover:fp-bg-accent",
                      // Today reads as a ring, so it survives being inside the band.
                      isToday &&
                        !selected &&
                        "fp-font-semibold fp-ring-1 fp-ring-inset fp-ring-line-strong hover:fp-ring-faint",
                    )}
                  >
                    {d.getDate()}
                  </button>
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
