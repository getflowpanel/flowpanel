import { DEFAULT_FORMATTING, type ResolvedFormatting } from "@flowpanel/core/format";
import type * as React from "react";

import { LocalTime } from "../_atoms/LocalTime";

const DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
};

const DATE_FMTS = new Map<string, Intl.DateTimeFormat>();

function dateFmt({ dateLocale, timeZone }: ResolvedFormatting): Intl.DateTimeFormat {
  const key = `${dateLocale}|${timeZone}`;
  let fmt = DATE_FMTS.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(dateLocale, { ...DATE_OPTIONS, timeZone });
    DATE_FMTS.set(key, fmt);
  }
  return fmt;
}

/** Plain-text rendering, for exports and for content that is not a React tree. */
export function formatCell(
  v: unknown,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): React.ReactNode {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return dateFmt(formatting).format(v).replace(",", "");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return dateFmt(formatting).format(d).replace(",", "");
  }
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

/** Render a cell value as React content. */
export function renderCellValue(
  v: unknown,
  formatting: ResolvedFormatting = DEFAULT_FORMATTING,
): React.ReactNode {
  if (v instanceof Date) return <LocalTime date={v} />;
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return <LocalTime date={v} />;
  }
  return formatCell(v, formatting);
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
