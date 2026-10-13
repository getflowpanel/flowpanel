"use client";
import { csvField } from "@flowpanel/core/internal";
import { formatLabel } from "@flowpanel/core/labels";
import { useToast } from "../feedback/toast-api";
import { resolveFieldLabel } from "../lib/humanize";
import { triggerDownload } from "../lib/trigger-download";
import { useApiBase } from "../provider/ApiBaseContext";
import { useLabels } from "../provider/LabelsContext";
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
  /**
   * The resource behind the table. Set, the server exports every row matching the page's
   * filters, search and sort; unset, the rows on screen are downloaded.
   */
  resource?: string;
}

/** The file name the server chose, from `Content-Disposition`. */
function attachmentName(res: Response, fallback: string): string {
  const match = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "");
  return match?.[1] ?? fallback;
}

function useServerExport(resource: string | undefined, tableLabel: string) {
  const apiBase = useApiBase();
  const toast = useToast();
  const labels = useLabels();
  if (resource === undefined) return null;
  return async (format: ExportFormat) => {
    const params = new URLSearchParams(window.location.search);
    params.set("format", format);
    try {
      const res = await fetch(`${apiBase}/export/${encodeURIComponent(resource)}?${params}`);
      if (!res.ok) {
        toast.error(labels.table.exportFailed);
        return;
      }
      triggerDownload({
        filename: attachmentName(res, `${slugify(tableLabel)}.${format}`),
        data: await res.blob(),
      });
      const capped = res.headers.get("x-flowpanel-export-capped");
      if (capped) toast.warning(formatLabel(labels.table.exportCapped, { n: capped }));
    } catch {
      toast.error(labels.table.exportFailed);
    }
  };
}

export function ExportButton<Row extends Record<string, unknown>>({
  columns,
  rows,
  label,
  tableLabel,
  formats,
  resource,
}: ExportButtonProps<Row>) {
  const serverExport = useServerExport(resource, tableLabel);
  const { table } = useLabels();
  const formatLabels: Record<ExportFormat, string> = {
    csv: table.exportCsv,
    json: table.exportJson,
  };
  const run = (format: ExportFormat) =>
    serverExport ? void serverExport(format) : downloadRows(format, columns, rows, tableLabel);

  if (formats.length <= 1) {
    const format = formats[0] ?? "csv";
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => run(format)}>
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
          <DropdownMenuItem key={format} onSelect={() => run(format)}>
            {formatLabels[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
