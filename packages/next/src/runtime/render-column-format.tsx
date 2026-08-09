import type { ColumnFormat } from "@flowpanel/core";
import { StatusBadge } from "@flowpanel/react";
import type { ReactNode } from "react";

// @flowpanel/react ships every module behind a "use client" banner, so a server
// component may create its elements but never call its functions. This mirrors
// `renderFormatCell` / `formatNumericCell` for server-rendered surfaces.

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

function formatNumericValue(value: unknown, format: ColumnFormat): string {
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

/** Render a declarative `ColumnFormat` cell on the server. */
export function renderColumnFormat(format: ColumnFormat, value: unknown): ReactNode {
  if (format === "badge" || (typeof format === "object" && format.kind === "badge")) {
    if (value === null || value === undefined || value === "") return "—";
    const status = String(value);
    const tone =
      typeof format === "object" && format.kind === "badge" ? format.tones?.[status] : undefined;
    return (
      <StatusBadge
        status={status.replace(/_/g, " ")}
        className="capitalize"
        {...(tone ? { tone } : {})}
      />
    );
  }
  return formatNumericValue(value, format);
}
