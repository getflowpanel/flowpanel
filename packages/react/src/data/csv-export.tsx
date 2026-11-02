"use client";
import { formatLabel } from "@flowpanel/core/labels";
import { Download } from "lucide-react";
import { useToast } from "../feedback/toast-api";
import { triggerDownload } from "../lib/trigger-download";
import { useApiBase } from "../provider/ApiBaseContext";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { DataTableColumn } from "./data-table-types";
import { type ExportFormat, slugify } from "./export-file";

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

/** The capped-export warning, its row count grouped the way the admin's locale writes numbers. */
export function cappedMessage(template: string, capped: string, locale: string): string {
  return formatLabel(template, { n: new Intl.NumberFormat(locale).format(Number(capped)) });
}

function useServerExport(resource: string | undefined, tableLabel: string) {
  const apiBase = useApiBase();
  const toast = useToast();
  const labels = useLabels();
  const { locale } = useFormatting();
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
      if (capped) toast.warning(cappedMessage(labels.table.exportCapped, capped, locale));
    } catch {
      toast.error(labels.table.exportFailed);
    }
  };
}

/** A download icon on a phone, where the toolbar has no room for words, and the word above. */
function ExportFace({ label }: { label: string }) {
  return (
    <>
      <Download aria-hidden className="fp-h-4 fp-w-4 fp-text-faint sm:fp-hidden" />
      <span className="fp-hidden sm:fp-inline">{label}</span>
    </>
  );
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
    serverExport
      ? void serverExport(format)
      : void import("./csv-rows").then((rowsFile) =>
          rowsFile.downloadRows(format, columns, rows, tableLabel),
        );

  if (formats.length <= 1) {
    const format = formats[0] ?? "csv";
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={rows.length === 0}
        aria-label={label}
        onClick={() => run(format)}
      >
        <ExportFace label={label} />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={rows.length === 0}
          aria-label={label}
        >
          <ExportFace label={label} />
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
