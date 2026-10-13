"use client";
import { formatCount } from "@flowpanel/core/labels";
import { LiveIndicator } from "../atoms/LiveIndicator";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import type { RealtimeStatus } from "../realtime/context";
import { ExportButton } from "./csv-export";
import { type DataTableDensity, DensityToggle } from "./DensityToggle";
import type { DataTableColumn, DataTableProps } from "./data-table-types";
import { ImportButton } from "./ImportButton";

export interface DataTableToolbarProps<Row> {
  total: number;
  liveStatus: RealtimeStatus | null;
  density: DataTableDensity | null;
  onDensityChange: (density: DataTableDensity) => void;
  importable: { resource: string; formats: ("csv" | "json")[] } | undefined;
  exportSetup: ExportSetup<Row> | null;
  rows: Row[];
  tableLabel: string;
}

export interface ExportSetup<Row> {
  formats: ("csv" | "json")[];
  columns: DataTableColumn<Row>[];
  /** Set, the server exports every matching row instead of the rows on screen. */
  resource?: string;
}

/** What the export button offers, or `null` when the table has nothing to export. */
export function exportSetupOf<Row>(
  exportable: DataTableProps<Row>["exportable"],
  rowCount: number,
  columns: DataTableColumn<Row>[],
  visible: DataTableColumn<Row>[],
): ExportSetup<Row> | null {
  if (rowCount === 0 || !exportable) return null;
  const formats: ("csv" | "json")[] =
    exportable === true ? ["csv"] : (exportable.formats ?? ["csv"]);
  const fields = exportable === true ? undefined : exportable.fields;
  const resource = exportable === true ? undefined : exportable.resource;
  const byField = new Map(columns.map((c) => [String(c.field), c] as const));
  return {
    formats,
    columns: fields
      ? fields.map((field) => byField.get(field) ?? { field: field as keyof Row & string })
      : visible,
    ...(resource ? { resource } : {}),
  };
}

/** The band above a table: its row count, live status, density and file actions. */
export function DataTableToolbar<Row extends Record<string, unknown>>({
  total,
  liveStatus,
  density,
  onDensityChange,
  importable,
  exportSetup,
  rows,
  tableLabel,
}: DataTableToolbarProps<Row>) {
  const labels = useLabels();
  const { locale } = useFormatting();
  return (
    <div className="fp-flex fp-items-center fp-justify-end fp-gap-1 fp-border-b fp-border-line fp-bg-surface fp-px-3 fp-py-1.5">
      <span className="fp-mr-auto fp-text-xs fp-tabular-nums fp-text-faint">
        {formatCount(
          labels.plurals?.results ?? (total === 1 ? labels.table.result : labels.table.results),
          total,
          locale,
          new Intl.NumberFormat(locale).format(total),
        )}
      </span>
      {liveStatus ? <LiveIndicator status={liveStatus} /> : null}
      {density ? <DensityToggle density={density} onChange={onDensityChange} /> : null}
      {importable ? (
        <ImportButton
          resource={importable.resource}
          formats={importable.formats}
          label={labels.actions.import}
        />
      ) : null}
      {exportSetup ? (
        <ExportButton
          columns={exportSetup.columns}
          rows={rows}
          formats={exportSetup.formats}
          label={labels.actions.export}
          tableLabel={tableLabel}
          {...(exportSetup.resource ? { resource: exportSetup.resource } : {})}
        />
      ) : null}
    </div>
  );
}
