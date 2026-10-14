import { formatDateValue, formatDayValue } from "./format-column";
import {
  formatDurationValue,
  formatPercentValue,
  formatRelativeValue,
  isCalendarDay,
  toDateValue,
} from "./format-values";
import type { ResolvedFormatting } from "./types/formatting";
import { formatCount } from "./types/labels";
import type { WidgetFormat } from "./types/widget-context";

const MISSING = "—";

const isMissing = (value: number | null | undefined): value is null | undefined =>
  value === null || value === undefined || Number.isNaN(value);

/** The admin's formatters bound to its `formatting` — what a widget reads as `ctx.format`. */
export function bindFormat(formatting: ResolvedFormatting): WidgetFormat {
  const numbers = (options: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(formatting.locale, options);
  const moment = (value: unknown, render: (date: Date) => string): string => {
    const date = toDateValue(value);
    return date === null ? MISSING : render(date);
  };
  return {
    date: (value) =>
      moment(value, (date) =>
        formatDayValue(date, formatting, isCalendarDay(value) ? "UTC" : formatting.timeZone),
      ),
    dateTime: (value) =>
      moment(value, (date) =>
        isCalendarDay(value)
          ? formatDayValue(date, formatting, "UTC")
          : formatDateValue(date, formatting),
      ),
    relative: (value, now) => moment(value, (date) => formatRelativeValue(date, formatting, now)),
    number: (value, digits) =>
      isMissing(value)
        ? MISSING
        : numbers(digits === undefined ? {} : { maximumFractionDigits: digits }).format(value),
    money: (value, options) => {
      if (isMissing(value)) return MISSING;
      const digits = options?.digits ?? 0;
      const scale = 10 ** (options?.minorUnits ?? 0);
      return numbers({
        style: "currency",
        currency: options?.currency ?? formatting.currency,
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value / scale);
    },
    percent: (value, digits) =>
      isMissing(value) ? MISSING : formatPercentValue(value, formatting, digits),
    duration: (ms) => (isMissing(ms) ? MISSING : formatDurationValue(ms, formatting)),
    plural: (count, label) =>
      formatCount(label, count, formatting.locale, numbers({}).format(count)),
  };
}
