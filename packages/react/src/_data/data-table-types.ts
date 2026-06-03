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
  /**
   * Adapter introspection hint propagated from `ColumnMeta.type`. When set
   * (and the cell isn't server-prerendered or hand-rendered via `render`),
   * the table dispatches to a specialized cell component:
   *
   * - `"array"` → `<ArrayCell>` (chip pills + overflow)
   * - `"json"` → `<JsonCell>` (popover with formatted JSON)
   * - `"reference"` → `<ReferenceCell>` (resolved label as a link)
   *
   * Other types fall through to the default `formatCell` formatter.
   */
  type?: "string" | "number" | "boolean" | "date" | "json" | "enum" | "array" | "reference";
  /**
   * When true (and `inlineEditResource` is set on the table), the cell
   * renders as `<InlineEditCell>` — double-click to edit, Enter/blur to
   * save via `POST /api/flowpanel/<resource>/<id>/update`.
   */
  editable?: boolean;
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
  /**
   * Row spacing. `"comfortable"` (default) uses the standard padding;
   * `"compact"` tightens vertical padding and shrinks text for dense lists.
   * Controlled — pass `showDensityToggle` to render the built-in toggle.
   */
  density?: DataTableDensity;
  loading?: boolean;
  onRowClick?: (row: Row) => void;
  onSortChange?: (sort: DataTableSort<Row>) => void;
  onPageChange?: (page: number) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /**
   * Decorative icon/emoji rendered above the empty-state title. Strings
   * are rendered as a centered glyph; React nodes are mounted verbatim
   * (useful for a lucide icon). Hidden from assistive tech via
   * `aria-hidden` — the title carries the meaning.
   */
  emptyIcon?: React.ReactNode;
  className?: string;
  selection?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** When provided, the caller controls row-key extraction; defaults to String(row[rowKey]). */
  getRowKey?: (row: Row) => string;
  /**
   * Server-prerendered cell content, indexed `[rowIndex][colIndex]` against
   * the `rows` array and the original `columns` array order. Used when the
   * caller wants `ColumnDef.render(row, ctx) => ReactNode` to execute on the
   * server (so the function never crosses the RSC → Client boundary). When
   * the cell entry is `undefined`, the table falls back to `column.render`
   * (if present) or to `String(row[col.field])`.
   */
  prerenderedCells?: (React.ReactNode | undefined)[][];
  columnVisibility?: Record<string, boolean>;
  columnWidths?: Record<string, number>;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  pinnedColumns?: { left?: string[]; right?: string[] };
  onPinnedColumnsChange?: (pinned: { left?: string[]; right?: string[] }) => void;
  /**
   * Subscribe to an SSE channel and trigger `router.refresh()` on events.
   * Pass a string for the channel or an object with `debounceMs` (default 200).
   * Requires Next.js router context.
   */
  realtime?: string | { channel: string; debounceMs?: number };
  /**
   * Optional trailing cell rendered after every row — typically a row-action
   * menu or an inline button strip. When set, a sticky-right column is added.
   * Skeleton rows render an empty placeholder of the same width so layout
   * doesn't shift during loading.
   */
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
  /**
   * Resource name used to construct the URL for inline-edit saves
   * (`POST /api/flowpanel/<inlineEditResource>/<id>/update`). When unset,
   * `column.editable === true` is ignored and cells render read-only.
   */
  inlineEditResource?: string;
  /**
   * Mobile layout when the viewport is narrower than 640px.
   *
   * - `"card"` (default): each row becomes a card with the title column
   *   prominent and the rest stacked. Touch-optimised.
   * - `"scroll"`: keep the desktop table and let the browser scroll
   *   horizontally. Useful for spreadsheet-style admins where the column
   *   grid carries the meaning.
   * - `false`: hide the table on mobile entirely (rare; use when the
   *   resource is genuinely desktop-only).
   */
  mobileLayout?: "card" | "scroll" | false;
  /**
   * When true, renders an "Export CSV" button in the toolbar that downloads
   * the visible columns of the rows currently on screen. Default `false`.
   */
  exportable?: boolean;
  /**
   * When true, renders the built-in `<DensityToggle>` in the toolbar wired to
   * internal state (seeded from `density`). Default `false` — without it the
   * table honours the controlled `density` prop only.
   */
  showDensityToggle?: boolean;
}
