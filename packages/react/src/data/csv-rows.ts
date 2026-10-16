import { csvField } from "@flowpanel/core/internal";
import { resolveFieldLabel } from "../lib/humanize";
import { triggerDownload } from "../lib/trigger-download";
import type { DataTableColumn } from "./data-table-types";
import { type ExportFormat, slugify } from "./export-file";
import { formatCell } from "./format-cell";

/** Coerce a cell value to a CSV string. */
function cellToCsvString(value: unknown): string {
  const formatted = formatCell(value);
  if (typeof formatted === "string") return formatted;
  if (value === null || value === undefined) return "";
  return String(value);
}

/** `__cell_<i>` columns are server-rendered cells — no row property stands behind them. */
const SYNTHETIC_FIELD = /^__cell_\d+$/;

function exportable<Row extends Record<string, unknown>>(
  columns: DataTableColumn<Row>[],
): DataTableColumn<Row>[] {
  return columns.filter((c) => !SYNTHETIC_FIELD.test(c.field));
}

export function rowsToCsv<Row extends Record<string, unknown>>(
  columns: DataTableColumn<Row>[],
  rows: Row[],
): string {
  const cols = exportable(columns);
  const header = cols.map((c) => csvField(resolveFieldLabel(c.label, c.field)));
  const body = rows.map((row) =>
    cols.map((c) => csvField(cellToCsvString(row[c.field]))).join(","),
  );
  return [header.join(","), ...body].join("\r\n");
}

/** Serialize rows to JSON, one object per row keyed by field. */
export function rowsToJson<Row extends Record<string, unknown>>(
  columns: DataTableColumn<Row>[],
  rows: Row[],
): string {
  const cols = exportable(columns);
  const data = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const c of cols) obj[c.field] = row[c.field] ?? null;
    return obj;
  });
  return JSON.stringify(data, null, 2);
}

/** The rows on screen as a file; loaded with the first export, not with the table. */
export function downloadRows<Row extends Record<string, unknown>>(
  format: ExportFormat,
  columns: DataTableColumn<Row>[],
  rows: Row[],
  tableLabel: string,
): void {
  const slug = slugify(tableLabel);
  if (format === "json") {
    triggerDownload({
      filename: `${slug}-${rows.length}-rows.json`,
      data: rowsToJson(columns, rows),
      mime: "application/json;charset=utf-8",
    });
    return;
  }
  triggerDownload({
    filename: `${slug}-${rows.length}-rows.csv`,
    data: rowsToCsv(columns, rows),
    mime: "text/csv;charset=utf-8",
  });
}
