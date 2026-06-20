import type { ColumnFormat } from "@flowpanel/core";
import type * as React from "react";
import type { DataTableDensity } from "./DensityToggle.js";

export interface DataTableColumn<Row> {
  field: keyof Row & string;
  label?: string;
  render?: (row: Row) => React.ReactNode;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "center" | "right";
  hidden?: boolean;
  className?: string;
  /** Adapter introspection hint propagated from `ColumnMeta.type`. */
  type?: "string" | "number" | "boolean" | "date" | "json" | "enum" | "array" | "reference";
  editable?: boolean;
  /** Declarative formatter mirrored from `ColumnDef.format`. */
  format?: ColumnFormat;
}

export interface DataTableSort<Row> {
  field: keyof Row & string;
  dir: "asc" | "desc";
}

export interface DataTableProps<Row> {
  columns: DataTableColumn<Row>[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  rowKey: keyof Row & string;
  sort?: DataTableSort<Row> | null;
  /** Row spacing. */
  density?: DataTableDensity;
  loading?: boolean;
  onRowClick?: (row: Row) => void;
  onSortChange?: (sort: DataTableSort<Row>) => void;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /** Decorative icon/emoji rendered above the empty-state title. */
  emptyIcon?: React.ReactNode;
  className?: string;
  selection?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** When provided, the caller controls row-key extraction; defaults to String(row[rowKey]). */
  getRowKey?: (row: Row) => string;
  prerenderedCells?: (React.ReactNode | undefined)[][];
  columnVisibility?: Record<string, boolean>;
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  pinnedColumns?: { left?: string[]; right?: string[] };
  onPinnedColumnsChange?: (pinned: { left?: string[]; right?: string[] }) => void;
  /** Subscribe to an SSE channel and trigger `router.refresh()` on events. */
  realtime?: string | { channel: string; debounceMs?: number };
  rowEndCell?: (row: Row, rowIndex: number) => React.ReactNode;
  /** Accessible label for the trailing column header. Defaults to "Actions". */
  rowEndCellLabel?: string;
  /** Triggered when the user presses `e` on a focused row. */
  onEditRow?: (row: Row) => void;
  /** Triggered when the user presses `d` on a focused row. */
  onDeleteRow?: (row: Row) => void;
  /** Triggered when the user presses `/`. Typically focuses the search input. */
  onFocusSearch?: () => void;
  /** Triggered when the user presses `?`. Typically opens the cheatsheet. */
  onShowShortcuts?: () => void;
  inlineEditResource?: string;
  /** Mobile layout when the viewport is narrower than 640px. */
  mobileLayout?: "card" | "scroll" | false;
  /** When set, renders an "Export" button in the toolbar that downloads the rows currently on screen. */
  exportable?: boolean | { formats?: ("csv" | "json")[]; fields?: string[] };
  importable?: { resource: string; formats: ("csv" | "json")[] };
  showDensityToggle?: boolean;
}
