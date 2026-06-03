"use client";
import { resolveFieldLabel } from "../lib/humanize.js";
import { triggerDownload } from "../lib/trigger-download.js";
import { Button } from "../ui/button.js";
import type { DataTableColumn } from "./data-table-types.js";
import { formatCell } from "./format-cell.js";

/**
 * Neutralize spreadsheet formula injection: if the field starts with a
 * formula trigger (`= + - @`) or a control char (tab/CR) that some
 * spreadsheets treat as a leading separator, prefix a single quote so the
 * value is parsed as literal text. Applied before RFC-4180 quoting.
 */
function neutralizeFormula(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

/**
 * RFC 4180 field escaping: wrap in double quotes and double any embedded
 * quotes when the value contains a comma, quote, CR, or LF. Formula-injection
 * neutralization runs first so the `'` prefix is inside the quoted field.
 */
function escapeCsvField(value: string): string {
  const safe = neutralizeFormula(value);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/**
 * Coerce a cell value to a CSV string. We reuse `formatCell` for its
 * date/boolean normalization; when it yields a non-string React node we
 * fall back to `String(value)` (the raw cell value), never the node.
 */
function cellToCsvString(value: unknown): string {
  const formatted = formatCell(value);
  if (typeof formatted === "string") return formatted;
  if (value === null || value === undefined) return "";
  return String(value);
}

export function rowsToCsv<Row extends Record<string, unknown>>(
  columns: DataTableColumn<Row>[],
  rows: Row[],
): string {
  const header = columns.map((c) => escapeCsvField(resolveFieldLabel(c.label, c.field)));
  const body = rows.map((row) =>
    columns.map((c) => escapeCsvField(cellToCsvString(row[c.field]))).join(","),
  );
  return [header.join(","), ...body].join("\r\n");
}

/**
 * Build a filesystem-friendly slug from a table/resource label, falling back
 * to `"export"` when nothing usable remains.
 */
function slugify(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "export";
}

export interface CsvExportButtonProps<Row extends Record<string, unknown>> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  label: string;
  /** Label used for the download filename slug. */
  tableLabel: string;
}

export function CsvExportButton<Row extends Record<string, unknown>>({
  columns,
  rows,
  label,
  tableLabel,
}: CsvExportButtonProps<Row>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        const csv = rowsToCsv(columns, rows);
        triggerDownload({
          filename: `${slugify(tableLabel)}-${rows.length}-rows.csv`,
          data: csv,
          mime: "text/csv;charset=utf-8",
        });
      }}
    >
      {label}
    </Button>
  );
}
