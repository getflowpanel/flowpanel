import {
  DEFAULT_FORMATTING,
  type FormattingConfig,
  type ResolvedFormatting,
  resolveFormatting,
} from "./types/formatting";
import type { ColumnFormat } from "./types/resource";
import type { NumericFormat } from "./types/widget";

export type { ColumnFormat, FormattingConfig, NumericFormat, ResolvedFormatting };
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

/**
 * Format the `money` / `number` variants of {@link ColumnFormat} as a string.
 * Server- and client-rendered cells share it so the same value reads the same
 * on both; the `badge` variant is JSX and stays with each renderer.
 */
export function formatColumnValue(
  value: unknown,
  format: ColumnFormat,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "number" && typeof value !== "string") return String(value);
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  const { locale, currency } = formatting;
  if (format === "number") return numberFmt(locale).format(n);
  if (format === "money") return moneyFmt(locale, currency).format(n);
  if (typeof format === "object" && format.kind === "money") {
    const scale = format.scale && format.scale > 0 ? format.scale : 1;
    return moneyFmt(locale, format.currency ?? currency).format(n / scale);
  }
  return String(value);
}

/**
 * Format the `NumericFormat` variants a widget declares. Locale and currency both
 * come from the admin's resolved `formatting`, so one dashboard never prints two
 * currencies for the same money.
 */
export function formatNumber(
  value: number,
  format: NumericFormat = "number",
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): string {
  if (!Number.isFinite(value)) return String(value);
  const { locale, currency } = formatting;
  switch (format) {
    case "currency":
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    case "percent":
      return new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
      }).format(value);
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
    case "duration": {
      const s = Math.round(value / 1000);
      if (s < 60) return `${s}s`;
      if (s < 3600) return `${Math.round(s / 60)}m`;
      return `${(s / 3600).toFixed(1)}h`;
    }
    default:
      return numberFmt(locale).format(value);
  }
}
