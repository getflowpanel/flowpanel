import { formatDateTime } from "./date-time";
import {
  columnFormatKind,
  formatBooleanValue,
  formatDurationValue,
  formatPercentValue,
  formatRelativeValue,
  isCalendarDay,
  toDateValue,
} from "./format-values";
import {
  DEFAULT_FORMATTING,
  type FormattingConfig,
  type ResolvedFormatting,
  resolveFormatting,
} from "./types/formatting";
import type { ColumnFormat } from "./types/resource";
import type { NumericFormat, Tone } from "./types/widget";

export type { ColumnFormat, FormattingConfig, NumericFormat, ResolvedFormatting };

/** The props a `badge` cell hands its `StatusBadge`. */
export interface BadgeCellProps {
  /** The raw value with `_` spaced out; the tone is inferred from it. */
  status: string;
  /** `format.labels[value]`, shown instead of `status`. */
  label?: string;
  /** `format.tones[value]`. */
  tone?: Tone;
  /** `"capitalize"` when there is no label. */
  className?: string;
}

/**
 * A `badge` cell's props for `value`, or `null` for an empty value. Server and
 * client renderers share it; tones and labels stay keyed by the raw value.
 */
export function badgeProps(format: ColumnFormat, value: unknown): BadgeCellProps | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = String(value);
  const tone =
    typeof format === "object" && format.kind === "badge" ? format.tones?.[raw] : undefined;
  const label =
    typeof format === "object" && format.kind === "badge" ? format.labels?.[raw] : undefined;
  return {
    status: raw.replace(/_/g, " "),
    ...(label === undefined ? { className: "capitalize" } : { label }),
    ...(tone ? { tone } : {}),
  };
}
export { formatDateTime } from "./date-time";
export {
  type ColumnFormatKind,
  cellTone,
  columnFormatKind,
  formatBooleanValue,
  formatDurationCompact,
  formatDurationValue,
  formatPercentValue,
  formatRelativeValue,
  percentHeatLevel,
  toBooleanValue,
  toDateValue,
  urlCellParts,
} from "./format-values";
export {
  currencyDigits,
  MAX_MINOR_UNITS,
  type MoneyStorage,
  majorUnitsInput,
  moneyDecimals,
  moneyMinorUnits,
  moneyStorage,
  parseMajorUnits,
  parseMoney,
} from "./money-input";
export { toneFillClass, toneTextClass } from "./tone-classes";
export { toneFor } from "./tone-for";
export type { Threshold } from "./types/threshold";
export { DEFAULT_FORMATTING, resolveFormatting };

const NUMBER_FMTS = new Map<string, Intl.NumberFormat>();
const MONEY_FMTS = new Map<string, Intl.NumberFormat>();

function numberFmt(locale: string): Intl.NumberFormat {
  let fmt = NUMBER_FMTS.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale);
    NUMBER_FMTS.set(locale, fmt);
  }
  return fmt;
}

function moneyFmt(locale: string, currency: string): Intl.NumberFormat {
  const key = `${locale}|${currency}`;
  let fmt = MONEY_FMTS.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { style: "currency", currency });
    MONEY_FMTS.set(key, fmt);
  }
  return fmt;
}

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};
const DAY_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
};

/**
 * The timestamp shape every FlowPanel surface shows — table cells, stat and kv
 * cards, chart ticks — in the admin's `dateLocale` and `timeZone`.
 */
export function formatDateValue(
  value: Date,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
  timeZone: string = formatting.timeZone,
): string {
  return formatDateTime(value, formatting.dateLocale, { ...DATE_OPTIONS, timeZone }, " ");
}

/** The same date without the clock, for a label a full timestamp would crowd. */
export function formatDayValue(
  value: Date,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
  timeZone: string = formatting.timeZone,
): string {
  return formatDateTime(value, formatting.dateLocale, { ...DAY_OPTIONS, timeZone });
}

/**
 * Formats every string-shaped variant of {@link ColumnFormat}, shared by server- and client-rendered cells.
 * The `badge` variant is JSX and stays with each renderer; here it reads as its label.
 */
export function formatColumnValue(
  value: unknown,
  format: ColumnFormat,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof format === "object" && format.kind === "badge") {
    return format.labels?.[String(value)] ?? String(value);
  }
  const kind = columnFormatKind(format);
  if (kind === "date" || kind === "relative") return formatMoment(value, format, formatting);
  if (kind === "boolean") return formatBooleanValue(value, format);
  if (kind === "url") return String(value);
  if (typeof value !== "number" && typeof value !== "string") return String(value);
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  const { locale, currency } = formatting;
  if (kind === "percent") {
    const digits =
      typeof format === "object" && format.kind === "percent" ? format.digits : undefined;
    return formatPercentValue(n, formatting, digits);
  }
  if (kind === "duration") {
    const seconds = typeof format === "object" && format.kind === "duration" && format.unit === "s";
    return formatDurationValue(seconds ? n * 1000 : n, formatting);
  }
  if (kind === "number") return numberFmt(locale).format(n);
  if (format === "money") return moneyFmt(locale, currency).format(n);
  if (typeof format === "object" && format.kind === "money") {
    const scale = format.scale && format.scale > 0 ? format.scale : 1;
    return moneyFmt(locale, format.currency ?? currency).format(n / scale);
  }
  return String(value);
}

function formatMoment(
  value: unknown,
  format: ColumnFormat,
  formatting: ResolvedFormatting,
): string {
  const date = toDateValue(value);
  if (date === null) return String(value);
  if (columnFormatKind(format) === "relative") return formatRelativeValue(date, formatting);
  const dateFormat = typeof format === "object" && format.kind === "date" ? format : null;
  if (isCalendarDay(value) || dateFormat?.calendarDay === true) {
    return formatDayValue(date, formatting, "UTC");
  }
  const withTime = dateFormat?.time === true;
  return withTime ? formatDateValue(date, formatting) : formatDayValue(date, formatting);
}

/**
 * Formats the `NumericFormat` variants a widget declares; locale and currency come from the admin's resolved `formatting`.
 * A bare locale string is still accepted as the 0.2 signature.
 */
export function formatNumber(
  value: number,
  format: NumericFormat = "number",
  formatting: string | ResolvedFormatting = DEFAULT_FORMATTING,
): string {
  if (!Number.isFinite(value)) return String(value);
  const resolved =
    typeof formatting === "string" ? { ...DEFAULT_FORMATTING, locale: formatting } : formatting;
  const { locale, currency } = resolved;
  switch (format) {
    case "currency":
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    case "percent":
      return formatPercentValue(value, resolved);
    case "bytes": {
      const units = ["B", "KB", "MB", "GB", "TB"];
      let i = 0;
      let n = value;
      while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
      }
      return `${n.toFixed(n >= 10 ? 0 : 1)} ${units[i]}`;
    }
    case "duration":
      return formatDurationValue(value, resolved);
    default:
      return numberFmt(locale).format(value);
  }
}
