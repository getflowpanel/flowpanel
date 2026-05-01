"use client";
import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  useAdminDrawer,
} from "@flowpanel/react";

/**
 * Thin wrapper around `<DataTable>` that intercepts row clicks and opens the
 * URL-synced drawer. Used from the server-rendered ResourceListPage when
 * `resource.options.rowClick === "drawer"`.
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
}

export function DataTableWithDrawerRows<Row extends Record<string, unknown>>(
  props: DataTableWithDrawerRowsProps<Row>,
) {
  const { resource, rowKey, sort, emptyTitle, ...rest } = props;
  const { open } = useAdminDrawer();
  return (
    <DataTable
      {...rest}
      rowKey={rowKey}
      {...(sort ? { sort } : {})}
      {...(emptyTitle ? { emptyTitle } : {})}
      onRowClick={(row) => {
        const id = row[rowKey];
        if (id === undefined || id === null) return;
        open({ resource, id: String(id) });
      }}
    />
  );
}
