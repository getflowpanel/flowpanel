"use client";
import { Check, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/cn";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui/popover";
import {
  addDays,
  addMonths,
  Calendar,
  type CalendarRange,
  fromISODate,
  monthTitle,
  RANGE_PRESETS,
  startOfDay,
  toISODate,
} from "../Calendar";
import { FilterField } from "./FilterField";

export interface DateRangeFilterProps {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
}

/** `[from, to]` as local dates. Either side may be absent — the wire format allows one-sided ranges. */
function parseValue(value: string | null): CalendarRange {
  const [from = "", to = ""] = (value ?? "").split(":");
  return { from: fromISODate(from), to: fromISODate(to) };
}

function serialize(range: CalendarRange): string | null {
  const from = range.from ? toISODate(range.from) : "";
  const to = range.to ? toISODate(range.to) : "";
  return from === "" && to === "" ? null : `${from}:${to}`;
}

const NAV_BUTTON =
  "fp-press inline-flex h-7 w-7 items-center justify-center rounded-fp-sm text-fp-text-2 hover:bg-fp-bg-3 hover:text-fp-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40";

export function DateRangeFilter({ label, value, onChange }: DateRangeFilterProps) {
  const committed = parseValue(value);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<CalendarRange>(committed);
  const [hovered, setHovered] = React.useState<Date | null>(null);
  const [month, setMonth] = React.useState(() => {
    const anchor = committed.from ?? new Date();
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  });
  const [focused, setFocused] = React.useState(() => committed.from ?? startOfDay(new Date()));
  const gridRef = React.useRef<HTMLDivElement>(null);
  const focusPending = React.useRef(false);

  // Only chase the DOM after a key moved the tabstop — never on open, or the
  // popover would steal focus from the trigger the moment it mounts.
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

  const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";
  const trigger = React.useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" });
    const withYear = new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const thisYear = new Date().getFullYear();
    const show = (d: Date) => (d.getFullYear() === thisYear ? fmt : withYear).format(d);
    if (committed.from && committed.to) return `${show(committed.from)} – ${show(committed.to)}`;
    if (committed.from) return `From ${show(committed.from)}`;
    if (committed.to) return `Until ${show(committed.to)}`;
    return null;
  }, [committed.from, committed.to, locale]);

  // Which preset the committed range corresponds to, if any — so reopening the
  // picker shows what is applied rather than an unmarked list.
  const activePreset = React.useMemo(() => {
    if (!committed.from || !committed.to) return null;
    const key = `${toISODate(committed.from)}:${toISODate(committed.to)}`;
    return (
      RANGE_PRESETS.find((p) => {
        const r = p.range();
        return r.from && r.to && `${toISODate(r.from)}:${toISODate(r.to)}` === key;
      })?.label ?? null
    );
  }, [committed.from, committed.to]);

  const commit = (next: CalendarRange) => {
    setDraft(next);
    onChange(serialize(next));
    setHovered(null);
    setOpen(false);
  };

  // First click opens a new range, second closes it — and a backwards second
  // click is read as "I meant to start here" rather than an invalid range.
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
            const anchor = committed.from ?? startOfDay(new Date());
            setMonth(new Date(anchor.getFullYear(), anchor.getMonth(), 1));
            setFocused(anchor);
          }
        }}
      >
        <PopoverTrigger
          className="fp-press flex h-11 min-w-0 items-center gap-2 rounded-full text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 sm:h-8"
          aria-label={label ? `${label}: date range` : "Date range"}
        >
          <span className={cn("truncate", trigger ? "text-fp-text-1" : "text-fp-text-3")}>
            {trigger ?? "Any date"}
          </span>
          {/* Matches the chevron on the Select pills beside it; the label
              already says what the field is, so a calendar glyph is noise. */}
          {trigger ? null : <ChevronDown aria-hidden className="h-4 w-4 shrink-0 opacity-50" />}
        </PopoverTrigger>
        {trigger ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear date range"
            className="fp-press -mr-3 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-fp-text-3 hover:bg-fp-bg-3 hover:text-fp-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40 sm:mr-0 sm:h-6 sm:w-6"
          >
            <X aria-hidden className="h-3.5 w-3.5" />
          </button>
        ) : null}

        {/* The preset row is what makes the panel wide on a phone; cap it and
            let that row scroll rather than pushing days off the viewport. */}
        <PopoverContent
          align="start"
          collisionPadding={8}
          className="w-auto max-w-[calc(100vw-1rem)] p-0"
        >
          <div className="flex flex-col sm:flex-row">
            <ul className="flex shrink-0 gap-1 overflow-x-auto border-fp-border-1 p-2 sm:w-40 sm:flex-col sm:gap-0.5 sm:border-r sm:p-2.5">
              {RANGE_PRESETS.map((p) => {
                const isActive = activePreset === p.label;
                return (
                  <li key={p.label}>
                    <button
                      type="button"
                      onClick={() => commit(p.range())}
                      aria-pressed={isActive}
                      className={cn(
                        "fp-press flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-fp px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40",
                        isActive
                          ? "bg-fp-bg-3 font-medium text-fp-text-1"
                          : "text-fp-text-2 hover:bg-fp-bg-3/60 hover:text-fp-text-1",
                      )}
                    >
                      {p.label}
                      {isActive ? <Check aria-hidden className="h-4 w-4 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, -1))}
                  aria-label="Previous month"
                  className={NAV_BUTTON}
                >
                  <ChevronLeft aria-hidden className="h-4 w-4" />
                </button>
                {/* Each title is centred over its own grid, so the header tracks
                    the columns instead of floating over the pair. */}
                <div aria-live="polite" className="flex flex-1 text-[0.9375rem] font-medium">
                  <span className="flex-1 text-center">{monthTitle(month, locale)}</span>
                  <span className="hidden flex-1 text-center sm:block">
                    {monthTitle(addMonths(month, 1), locale)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMonth(addMonths(month, 1))}
                  aria-label="Next month"
                  className={NAV_BUTTON}
                >
                  <ChevronRight aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <div ref={gridRef} className="flex gap-6">
                <Calendar
                  month={month}
                  range={draft}
                  hovered={hovered}
                  focused={focused}
                  onSelect={handleSelect}
                  onHover={setHovered}
                  onKeyDown={handleKeyDown}
                  locale={locale}
                  label="First month"
                />
                <div className="hidden sm:block">
                  <Calendar
                    month={addMonths(month, 1)}
                    range={draft}
                    hovered={hovered}
                    focused={focused}
                    onSelect={handleSelect}
                    onHover={setHovered}
                    onKeyDown={handleKeyDown}
                    locale={locale}
                    label="Second month"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-fp-border-1 px-3 py-2">
            <span className="text-xs text-fp-text-3">
              {draft.from && !draft.to ? "Pick an end date" : (trigger ?? "No range selected")}
            </span>
            <button
              type="button"
              onClick={() => {
                clear();
                setOpen(false);
              }}
              className="fp-press rounded-fp-sm px-2 py-1 text-xs font-medium text-fp-text-2 hover:bg-fp-bg-3 hover:text-fp-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40"
            >
              Clear
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </FilterField>
  );
}
