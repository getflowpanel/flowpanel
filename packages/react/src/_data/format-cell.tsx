import type { ColumnFormat } from "@flowpanel/core";
import type * as React from "react";

import { LocalTime } from "../_atoms/LocalTime.js";

const numberFmt = new Intl.NumberFormat("en-US");
const moneyFmtCache = new Map<string, Intl.NumberFormat>();
function moneyFmt(currency: string): Intl.NumberFormat {
  let fmt = moneyFmtCache.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat("en-US", { style: "currency", currency });
    moneyFmtCache.set(currency, fmt);
  }
  return fmt;
}

/** Render the `money` / `number` variants of {@link ColumnFormat}. */
export function formatNumericCell(value: unknown, format: ColumnFormat): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "number" && typeof value !== "string") return String(value);
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  if (format === "number") return numberFmt.format(n);
  if (format === "money") return moneyFmt("USD").format(n);
  if (typeof format === "object" && format.kind === "money") {
    const scale = format.scale && format.scale > 0 ? format.scale : 1;
    return moneyFmt(format.currency ?? "USD").format(n / scale);
  }
  return String(value);
}

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatCell(v: unknown): React.ReactNode {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return dateFmt.format(v).replace(",", "");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return dateFmt.format(d).replace(",", "");
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** Render a cell value as React content. */
export function renderCellValue(v: unknown): React.ReactNode {
  if (v instanceof Date) return <LocalTime date={v} />;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return <LocalTime date={v} />;
  }
  return formatCell(v);
}

export const ALIGN_CLASS = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

export function widthToCss(w: number | string | undefined): string | undefined {
  if (w === undefined) return undefined;
  return typeof w === "number" ? `${w}px` : w;
}
