"use client";
import {
  DataTable,
  type DataTableColumn,
  type DataTableDensity,
  type DataTableSort,
  type RealtimeChannels,
  RealtimeRefresh,
  useAdminDrawer,
  useAdminTable,
} from "@flowpanel/react";
import type { ReactNode } from "react";
import * as React from "react";
import { BulkActionsBar } from "../actions/BulkActionsBar.js";
import type { SerializedBulkAction } from "../actions/bulk-action.js";
import { RestoreButton } from "../actions/RestoreButton.js";
import { RowActionsMenu } from "../actions/RowActionsMenu.js";
import type { SerializedRowAction } from "../actions/row-action.js";

/** Thin wrapper around `<DataTable>` that wires realtime refresh and row-click drawer interaction. */
export interface DataTableWithDrawerRowsProps<Row extends Record<string, unknown>> {
  resource: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  /** Sizes offered by the pager; the server clamps `?perPage=` to this set. */
  pageSizeOptions?: number[];
  rowKey: keyof Row & string;
  sort?: DataTableSort<Row> | null;
  /** Initial row density from `resource.options.density`. Forwarded to `DataTable`. */
  density?: DataTableDensity;
  /** Export affordance, forwarded verbatim from `resource.options.export`. */
  exportable?: boolean | { formats?: ("csv" | "json")[]; fields?: string[] };
  /** Show the import button (from `resource.options.import`). */
  importable?: { resource: string; formats: ("csv" | "json")[] };
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
  /** Server-prerendered cell content (see DataTable.prerenderedCells). */
  prerenderedCells?: (ReactNode | undefined)[][];
  /** Wire-safe shape of `resource.options.actions`. */
  rowActions?: SerializedRowAction[];
  /** Per-row override of `rowActions`, keyed by row id. */
  rowActionsById?: Record<string, SerializedRowAction[]>;
  /** Wire-safe shape of `resource.options.bulkActions`. */
  bulkActions?: SerializedBulkAction[];
  deletedRowKeys?: string[];
  /** Open the URL-synced drawer when a row is clicked. */
  openDrawerOnRowClick?: boolean;
  /** SSE channel(s) to subscribe to for live refresh. */
  realtime?: RealtimeChannels;
}

export function DataTableWithDrawerRows<Row extends Record<string, unknown>>(
  props: DataTableWithDrawerRowsProps<Row>,
) {
  const {
    resource,
    rowKey,
    sort,
    emptyTitle,
    emptyDescription,
    emptyAction,
    emptyIcon,
    prerenderedCells,
    rowActions,
    rowActionsById,
    bulkActions,
    deletedRowKeys,
    openDrawerOnRowClick,
    realtime,
    ...rest
  } = props;
  const { open } = useAdminDrawer();
  const table = useAdminTable();

  const hasRowActions = rowActions && rowActions.length > 0;
  const hasBulkActions = bulkActions && bulkActions.length > 0;
  const deletedRowKeySet = deletedRowKeys && deletedRowKeys.length > 0 ? deletedRowKeys : undefined;
  const hasRestore = !!deletedRowKeySet;

  const [selection, setSelection] = React.useState<string[]>([]);

  return (
    <>
      {realtime ? <RealtimeRefresh channels={realtime} /> : null}
      {hasBulkActions ? (
        <BulkActionsBar
          resource={resource}
          selection={selection}
          onClear={() => setSelection([])}
          actions={bulkActions as SerializedBulkAction[]}
        />
      ) : null}
      <DataTable
        {...rest}
        rowKey={rowKey}
        {...(sort ? { sort } : {})}
        {...(emptyTitle ? { emptyTitle } : {})}
        {...(emptyDescription ? { emptyDescription } : {})}
        {...(emptyAction ? { emptyAction } : {})}
        {...(emptyIcon ? { emptyIcon } : {})}
        {...(prerenderedCells ? { prerenderedCells } : {})}
        onSortChange={(s) => table.setSort(s as { field: string; dir: "asc" | "desc" })}
        onPageChange={(p) => table.setPage(p)}
        onPageSizeChange={(n) => table.setPageSize(n)}
        inlineEditResource={resource}
        {...(hasBulkActions ? { selection, onSelectionChange: setSelection } : {})}
        {...(openDrawerOnRowClick
          ? {
              onRowClick: (row: Row) => {
                const id = row[rowKey];
                if (id === undefined || id === null) return;
                open({ resource, id: String(id) });
              },
            }
          : {})}
        {...(hasRowActions || hasRestore
          ? {
              rowEndCell: (row: Row) => {
                const id = row[rowKey];
                if (id === undefined || id === null) return null;
                const idStr = String(id);
                const acts = hasRowActions
                  ? (rowActionsById?.[idStr] ?? (rowActions as SerializedRowAction[]))
                  : [];
                const isDeleted = deletedRowKeySet?.includes(idStr) ?? false;
                if (!isDeleted) {
                  if (acts.length === 0) return null;
                  return <RowActionsMenu resource={resource} id={idStr} actions={acts} />;
                }
                return (
                  <div className="flex items-center justify-end gap-1">
                    <RestoreButton resource={resource} id={idStr} />
                    {acts.length > 0 ? (
                      <RowActionsMenu resource={resource} id={idStr} actions={acts} />
                    ) : null}
                  </div>
                );
              },
            }
          : {})}
      />
    </>
  );
}
