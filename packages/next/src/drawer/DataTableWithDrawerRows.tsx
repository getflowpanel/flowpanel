"use client";
import {
  DataTable,
  type DataTableColumn,
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
import { RowActionsMenu } from "../actions/RowActionsMenu.js";
import type { SerializedRowAction } from "../actions/row-action.js";

/**
 * Thin wrapper around `<DataTable>` that wires two server-driven behaviors:
 *
 * - **Drawer rows.** When `openDrawerOnRowClick` is set, clicking a row opens
 *   the URL-synced drawer via `useAdminDrawer().open({ resource, id })`.
 *
 * - **Trailing row actions.** When `rowActions` is non-empty, a sticky-right
 *   menu cell is rendered via `DataTable.rowEndCell`. The menu's wrapper
 *   stops `onClick` propagation so triggering an action never opens the
 *   drawer behind it.
 *
 * `resource` is always required — it's the URL segment for both the drawer
 * GET and the per-action POST.
 */
export interface DataTableWithDrawerRowsProps<Row extends Record<string, unknown>> {
  resource: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  rowKey: keyof Row & string;
  sort?: DataTableSort<Row> | null;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  emptyIcon?: ReactNode;
  /**
   * Server-prerendered cell content (see DataTable.prerenderedCells). Passed
   * through unchanged. ReactNode values are valid props in the RSC payload
   * even though function-valued props would not be — this is why
   * `ColumnDef.render` is executed server-side in `ResourceListPage`.
   */
  prerenderedCells?: (ReactNode | undefined)[][];
  /**
   * Wire-safe shape of `resource.options.actions`. When set + non-empty, the
   * table renders a trailing menu cell per row that POSTs to
   * `/api/flowpanel/<resource>/<id>/actions/<key>`.
   */
  rowActions?: SerializedRowAction[];
  /**
   * Wire-safe shape of `resource.options.bulkActions`. When set + non-empty,
   * the table renders a checkbox column and a floating `<BulkActionsBar>`
   * above it once one or more rows are selected.
   */
  bulkActions?: SerializedBulkAction[];
  /**
   * Open the URL-synced drawer when a row is clicked. Set in
   * `ResourceListPage` from `resource.options.rowClick === "drawer"`.
   */
  openDrawerOnRowClick?: boolean;
  /**
   * SSE channel(s) to subscribe to for live refresh. Set in `ResourceListPage`
   * from `resource.options.realtime` (`true` → `resource.<name>`). When an
   * event arrives the list re-fetches via `router.refresh()`.
   */
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
    bulkActions,
    openDrawerOnRowClick,
    realtime,
    ...rest
  } = props;
  const { open } = useAdminDrawer();
  const table = useAdminTable();

  const hasRowActions = rowActions && rowActions.length > 0;
  const hasBulkActions = bulkActions && bulkActions.length > 0;

  // Selection lives in local state. URL-persisting `?selected=...` is the
  // Phase 1 polish; for now the list is "click to select on this page" and
  // resets on navigation (which is the most common bulk flow anyway).
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
        {...(hasRowActions
          ? {
              rowEndCell: (row: Row) => {
                const id = row[rowKey];
                if (id === undefined || id === null) return null;
                return (
                  <RowActionsMenu
                    resource={resource}
                    id={String(id)}
                    actions={rowActions as SerializedRowAction[]}
                  />
                );
              },
            }
          : {})}
      />
    </>
  );
}
