import {
  DEFAULT_FORMATTING,
  type FormattingConfig,
  type ResolvedFormatting,
  resolveFormatting,
} from "./types/formatting";
import type { ColumnFormat } from "./types/resource";

export type { ColumnFormat, FormattingConfig, ResolvedFormatting };
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
