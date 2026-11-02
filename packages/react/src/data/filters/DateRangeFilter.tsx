"use client";
import { isDateRangePreset } from "@flowpanel/core/internal";
import { formatLabel } from "@flowpanel/core/labels";
import { Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";
import { useFormatting } from "../../provider/FormattingContext";
import { useLabels } from "../../provider/LabelsContext";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import {
  addDays,
  addMonths,
  Calendar,
  type CalendarRange,
  monthTitle,
  RANGE_PRESETS,
  todayIn,
  toISODate,
} from "../Calendar";
import { activePresetOf } from "./date-range-preset";
import { parseDateRangeValue, serializeDateRange } from "./date-range-value";
import { FilterField } from "./FilterField";

export interface DateRangeFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

const NAV_BUTTON =
  "fp-press fp-inline-flex fp-h-7 fp-w-7 fp-items-center fp-justify-center fp-rounded-sm fp-text-soft hover:fp-bg-fill hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60";

export function DateRangeFilter({ label, value, onChange }: DateRangeFilterProps) {
  const { dateRange } = useLabels();
  const { timeZone } = useFormatting();
  const committed = parseDateRangeValue(value, timeZone);
  const today = () => todayIn(timeZone);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<CalendarRange>(committed);
  const [hovered, setHovered] = React.useState<Date | null>(null);
  const [month, setMonth] = React.useState(() => {
    const anchor = committed.from ?? today();
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  });
  const [focused, setFocused] = React.useState(() => committed.from ?? today());
  const gridRef = React.useRef<HTMLDivElement>(null);
  const focusPending = React.useRef(false);

  // Only chase the DOM after a key moved the tabstop, never on open, or the popover steals focus on mount.
  React.useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current
      ?.querySelector<HTMLElement>(`[data-day="${toISODate(focused)}"]`)
      ?.querySelector("button")
      ?.focus();
  }, [focused]);

  const moveFocus = (next: Date) => {
    focusPending.current = true;
    setFocused(next);
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const lastShown = new Date(month.getFullYear(), month.getMonth() + 2, 0);
    if (next < first) setMonth(addMonths(month, -1));
    else if (next > lastShown) setMonth(addMonths(month, 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (e.key in step) {
      e.preventDefault();
      moveFocus(addDays(focused, step[e.key] as number));
      return;
    }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const delta = e.key === "PageUp" ? -1 : 1;
      moveFocus(new Date(focused.getFullYear(), focused.getMonth() + delta, focused.getDate()));
      return;
    }
    if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const shift = e.key === "Home" ? -focused.getDay() : 6 - focused.getDay();
      moveFocus(addDays(focused, shift));
    }
  };

  const locale = dateRange.locale;
  const rangeText = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
    const withYear = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const thisYear = todayIn(timeZone).getFullYear();
    const show = (d: Date) => (d.getFullYear() === thisYear ? fmt : withYear).format(d);
    if (committed.from && committed.to) return `${show(committed.from)} – ${show(committed.to)}`;
    if (committed.from) return formatLabel(dateRange.from, { date: show(committed.from) });
    if (committed.to) return formatLabel(dateRange.until, { date: show(committed.to) });
    return null;
  }, [committed.from, committed.to, locale, dateRange.from, dateRange.until, timeZone]);
  const named = isDateRangePreset(value) ? value : null;
  const trigger = named ? dateRange[named] : rangeText;
  const shown = trigger ?? dateRange.any;

  const activePreset = React.useMemo(
    () => activePresetOf(named, committed.from, committed.to, todayIn(timeZone)),
    [named, committed.from, committed.to, timeZone],
  );

  const commit = (next: CalendarRange) => {
    setDraft(next);
    onChange(serializeDateRange(next));
    setHovered(null);
    setOpen(false);
  };

  // First click opens a new range, second closes it; a backwards second click restarts instead of erroring.
  const handleSelect = (day: Date) => {
    if (!draft.from || draft.to) {
      setDraft({ from: day, to: null });
      return;
    }
    commit(day < draft.from ? { from: day, to: draft.from } : { from: draft.from, to: day });
  };

  const clear = () => {
    setDraft({ from: null, to: null });
    onChange(null);
  };

  return (
    <FilterField label={label} active={Boolean(trigger)}>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setDraft(committed);
            const anchor = committed.from ?? today();
            setMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
            setFocused(anchor);
          }
        }}
      >
        <PopoverTrigger
          className="fp-press fp-flex fp-h-11 fp-min-w-0 fp-items-center fp-gap-2 fp-rounded-full fp-text-sm focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 sm:fp-h-8"
          aria-label={[
            shown,
            label ? formatLabel(dateRange.fieldLabel, { label }) : dateRange.label,
          ].join(", ")}
        >
          <span className={cn("fp-truncate", trigger ? "fp-text-ink" : "fp-text-faint")}>
            {shown}
          </span>
          {/* Matches the chevron on the Select pills beside it; the label
              already says what the field is, so a calendar glyph is noise. */}
          {trigger ? null : (
            <ChevronDown aria-hidden className="fp-h-4 fp-w-4 fp-shrink-0 fp-opacity-50" />
          )}
        </PopoverTrigger>
        {trigger ? (
          <button
            type="button"
            onClick={clear}
            aria-label={dateRange.clear}
            className="fp-press -fp-mr-3 fp-inline-flex fp-h-11 fp-w-11 fp-shrink-0 fp-items-center fp-justify-center fp-rounded-full fp-text-faint hover:fp-bg-fill hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 sm:fp-mr-0 sm:fp-h-6 sm:fp-w-6"
          >
            <X aria-hidden className="fp-h-3.5 fp-w-3.5" />
          </button>
        ) : null}

        {/* The preset row is what makes the panel wide on a phone; cap it and
            let that row scroll rather than pushing days off the viewport. */}
        <PopoverContent
          align="start"
          collisionPadding={8}
          className="fp-w-auto fp-max-w-[calc(100vw-1rem)] fp-p-0"
        >
          <div className="fp-flex fp-flex-col sm:fp-flex-row">
            <ul className="fp-flex fp-shrink-0 fp-gap-1 fp-overflow-x-auto fp-border-line fp-p-2 sm:fp-w-40 sm:fp-flex-col sm:fp-gap-0.5 sm:fp-border-r sm:fp-p-2.5">
              {RANGE_PRESETS.map((p) => {
                const isActive = activePreset === p.key;
                return (
                  <li key={p.key}>
                    <button
                      type="button"
                      onClick={() => commit(p.range(today()))}
                      aria-pressed={isActive}
                      className={cn(
                        "fp-press fp-flex fp-w-full fp-items-center fp-justify-between fp-gap-2 fp-whitespace-nowrap fp-rounded fp-px-3 fp-py-2 fp-text-left fp-text-sm fp-transition-colors focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
                        isActive
                          ? "fp-bg-fill fp-font-medium fp-text-ink"
                          : "fp-text-soft hover:fp-bg-fill/60 hover:fp-text-ink",
                      )}
                    >
                      {dateRange[p.key]}
                      {isActive ? (
                        <Check aria-hidden className="fp-h-4 fp-w-4 fp-shrink-0" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="fp-p-3 sm:fp-p-4">
              <div className="fp-mb-3 fp-flex fp-items-center fp-gap-2">
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, -1))}
                  aria-label={dateRange.previousMonth}
                  className={NAV_BUTTON}
                >
                  <ChevronLeft aria-hidden className="fp-h-4 fp-w-4" />
                </button>
                {/* Each title is centred over its own grid, so the header tracks
                    the columns instead of floating over the pair. */}
                <div
                  aria-live="polite"
                  className="fp-flex fp-flex-1 fp-text-[0.9375rem] fp-font-medium"
                >
                  <span className="fp-flex-1 fp-text-center">{monthTitle(month, locale)}</span>
                  <span className="fp-hidden fp-flex-1 fp-text-center sm:fp-block">
                    {monthTitle(addMonths(month, 1), locale)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, 1))}
                  aria-label={dateRange.nextMonth}
                  className={NAV_BUTTON}
                >
                  <ChevronRight aria-hidden className="fp-h-4 fp-w-4" />
                </button>
              </div>
              <div ref={gridRef} className="fp-flex fp-gap-6">
                <Calendar
                  month={month}
                  range={draft}
                  hovered={hovered}
                  focused={focused}
                  onSelect={handleSelect}
                  onHover={setHovered}
                  onKeyDown={handleKeyDown}
                  locale={locale}
                  label={dateRange.firstMonth}
                />
                <div className="fp-hidden sm:fp-block">
                  <Calendar
                    month={addMonths(month, 1)}
                    range={draft}
                    hovered={hovered}
                    focused={focused}
                    onSelect={handleSelect}
                    onHover={setHovered}
                    onKeyDown={handleKeyDown}
                    locale={locale}
                    label={dateRange.secondMonth}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="fp-flex fp-items-center fp-justify-between fp-gap-3 fp-border-t fp-border-line fp-px-3 fp-py-2">
            <span className="fp-text-xs fp-text-faint">
              {draft.from && !draft.to ? dateRange.pickEnd : (trigger ?? dateRange.noSelection)}
            </span>
            <button
              type="button"
              onClick={() => {
                clear();
                setOpen(false);
              }}
              className="fp-press fp-rounded-sm fp-px-2 fp-py-1 fp-text-xs fp-font-medium fp-text-soft hover:fp-bg-fill hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
            >
              {dateRange.clearAction}
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}
