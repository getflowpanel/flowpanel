import type * as React from "react";
import { DataTable, type DataTableColumn } from "../_data/DataTable.js";
import { Card, CardHeader } from "../_layout/Card.js";
import type { RealtimeChannels } from "../hooks/useRealtimeRefresh.js";
import { RealtimeRefresh } from "../hooks/useRealtimeRefresh.js";

export interface TableWidgetProps<Row extends Record<string, unknown>> {
  label?: string;
  rows: Row[];
  columns: DataTableColumn<Row>[];
  rowKey: keyof Row & string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: Row) => void;
  /** Server-prerendered cell content, same shape as `DataTable.prerenderedCells`. */
  prerenderedCells?: (React.ReactNode | undefined)[][];
  /** SSE channel(s) to subscribe to. */
  realtime?: RealtimeChannels;
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
        {...(props.prerenderedCells ? { prerenderedCells: props.prerenderedCells } : {})}
        emptyTitle="No data"
      />
      {props.realtime ? <RealtimeRefresh channels={props.realtime} /> : null}
    </Card>
  );
}
