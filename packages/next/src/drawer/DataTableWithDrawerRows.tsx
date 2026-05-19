"use client";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  useAdminDrawer,
  useAdminTable,
} from "@flowpanel/react";

/**
 * Thin wrapper around `<DataTable>` that intercepts row clicks and opens the
 * URL-synced drawer. Used from the server-rendered ResourceListPage when
 * `resource.options.rowClick === "drawer"`.
 */
export interface DataTableWithDrawerRowsProps<Row extends Record<string, unknown>> {
  resource?: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  rowKey: keyof Row & string;
  sort?: DataTableSort<Row> | null;
  emptyTitle?: string;
}

export function DataTableWithDrawerRows<Row extends Record<string, unknown>>(
  props: DataTableWithDrawerRowsProps<Row>,
) {
  const { resource, rowKey, sort, emptyTitle, ...rest } = props;
  const { open } = useAdminDrawer();
  const table = useAdminTable();
  return (
    <DataTable
      {...rest}
      rowKey={rowKey}
      {...(sort ? { sort } : {})}
      {...(emptyTitle ? { emptyTitle } : {})}
      onSortChange={(s) => table.setSort(s as { field: string; dir: "asc" | "desc" })}
      onPageChange={(p) => table.setPage(p)}
      {...(resource
        ? {
            onRowClick: (row: Row) => {
              const id = row[rowKey];
              if (id === undefined || id === null) return;
              open({ resource, id: String(id) });
            },
          }
        : {})}
    />
  );
}
