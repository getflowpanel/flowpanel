import { LocalTime } from "@flowpanel/react";
import type { ReactNode } from "react";

const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/**
 * Render a record field value for KV / detail / drawer display. Dates — a
 * `Date` or an ISO-datetime string — render via `<LocalTime>` so they show in
 * the VIEWER's timezone; objects render as JSON; everything else as a string.
 * Single source of truth shared by the detail page and the drawer so the same
 * field renders identically in both.
 */
export function formatFieldValue(v: unknown): ReactNode {
  if (v === null || v === undefined) return "—";
  if (v instanceof Date) return <LocalTime date={v} />;
  if (typeof v === "string" && ISO_DATETIME_RE.test(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return <LocalTime date={v} />;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
