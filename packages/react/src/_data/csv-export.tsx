"use client";
import { resolveFieldLabel } from "../lib/humanize";
import { triggerDownload } from "../lib/trigger-download";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { DataTableColumn } from "./data-table-types";
import { formatCell } from "./format-cell";

export type ExportFormat = "csv" | "json";

function neutralizeFormula(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) {
    return `'${value}`;
  }
  return value;
}

function escapeCsvField(value: string): string {
  const safe = neutralizeFormula(value);
  if (/[",\r\n]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

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
  const header = cols.map((c) => escapeCsvField(resolveFieldLabel(c.label, c.field)));
  const body = rows.map((row) =>
    cols.map((c) => escapeCsvField(cellToCsvString(row[c.field]))).join(","),
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

function slugify(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "export";
}

function downloadRows<Row extends Record<string, unknown>>(
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

export interface ExportButtonProps<Row extends Record<string, unknown>> {
  /** Columns to include in the export. */
  columns: DataTableColumn<Row>[];
  rows: Row[];
  label: string;
  /** Label used for the download filename slug. */
  tableLabel: string;
  /** File formats the button offers. */
  formats: ExportFormat[];
}

const FORMAT_LABEL: Record<ExportFormat, string> = {
  csv: "Export as CSV",
  json: "Export as JSON",
};

export function ExportButton<Row extends Record<string, unknown>>({
  columns,
  rows,
  label,
  tableLabel,
  formats,
}: ExportButtonProps<Row>) {
  if (formats.length <= 1) {
    const format = formats[0] ?? "csv";
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => downloadRows(format, columns, rows, tableLabel)}
      >
        {label}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((format) => (
          <DropdownMenuItem
            key={format}
            onSelect={() => downloadRows(format, columns, rows, tableLabel)}
          >
            {FORMAT_LABEL[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
