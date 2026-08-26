import type { ColumnFormat } from "./types/resource";

export type { ColumnFormat };

const NUMBER_FMT = new Intl.NumberFormat("en-US");
const MONEY_FMTS = new Map<string, Intl.NumberFormat>();

function moneyFmt(currency: string): Intl.NumberFormat {
  let fmt = MONEY_FMTS.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
    MONEY_FMTS.set(currency, fmt);
  }
  return fmt;
}

/**
 * Format the `money` / `number` variants of {@link ColumnFormat} as a string.
 * Server- and client-rendered cells share it so the same value reads the same
 * on both; the `badge` variant is JSX and stays with each renderer.
 */
export function formatColumnValue(value: unknown, format: ColumnFormat): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "number" && typeof value !== "string") return String(value);
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  if (format === "number") return NUMBER_FMT.format(n);
  if (format === "money") return moneyFmt("USD").format(n);
  if (typeof format === "object" && format.kind === "money") {
    const scale = format.scale && format.scale > 0 ? format.scale : 1;
    return moneyFmt(format.currency ?? "USD").format(n / scale);
  }
  return String(value);
}
