/**
 * Minimal CSV export for the currently-visible table rows.
 *
 * We intentionally keep this client-side + per-page: streaming a full
 * dataset belongs on the server where the adapter can page through it.
 * For "give me what's on the screen" this is perfect.
 */

import type { SerializedColumn } from "@flowpanel/core";
import { getNestedValue } from "../utils/getNestedValue";

type Row = Record<string, unknown>;

/** Convert a value to a CSV-safe cell, quoting when needed. */
function csvCell(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Row[], columns: SerializedColumn[]): string {
  const visible = columns.filter((c) => c.opts.visible !== "detail");
  const headers = visible.map((c) => csvCell(c.label));
  const body = rows.map((row) =>
    visible
      .map((c) => {
        const raw = c.path ? getNestedValue(row, c.path) : undefined;
        return csvCell(raw);
      })
      .join(","),
  );
  return [headers.join(","), ...body].join("\n");
}

export function downloadCsv(filename: string, rows: Row[], columns: SerializedColumn[]): void {
  const csv = toCsv(rows, columns);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
