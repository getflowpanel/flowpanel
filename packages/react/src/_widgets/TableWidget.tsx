import type * as React from "react";
import { DataTable, type DataTableColumn } from "../_data/DataTable.js";
import { Card, CardHeader } from "../_layout/Card.js";

export interface TableWidgetProps<Row extends Record<string, unknown>> {
  label?: string;
  rows: Row[];
  columns: DataTableColumn<Row>[];
  rowKey: keyof Row & string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: Row) => void;
}

export function TableWidget<Row extends Record<string, unknown>>(props: TableWidgetProps<Row>) {
  return (
    <Card>
      {props.label ? <CardHeader>{props.label}</CardHeader> : null}
      <DataTable
        rows={props.rows}
        columns={props.columns}
        rowKey={props.rowKey}
        total={props.rows.length}
        page={1}
        pageSize={props.rows.length}
        {...(props.onRowClick ? { onRowClick: props.onRowClick } : {})}
        emptyTitle="No data"
      />
    </Card>
  );
}
