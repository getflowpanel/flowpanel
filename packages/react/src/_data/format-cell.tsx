import type * as React from "react";

import { LocalTime } from "../_atoms/LocalTime.js";

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

/**
 * Render a cell value as React content. Identical to {@link formatCell} for
 * non-temporal values, but renders `Date` / ISO-datetime strings through
 * {@link LocalTime} so they display in the VIEWER's timezone rather than the
 * server's (the classic "the table clock is hours off" bug). Use this for
 * on-screen rendering; keep `formatCell` for plain-string contexts (CSV export,
 * prerender-to-string).
 */
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
