"use client";
import * as React from "react";
import { DataTable, type DataTableColumn } from "../_data/DataTable";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import type { RealtimeChannels } from "../hooks/useRealtimeRefresh";
import { RealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { useRowNavigation } from "../hooks/useRowNavigation";

export interface TableWidgetProps<Row extends Record<string, unknown>> {
  label?: string;
  rows: Row[];
  columns: DataTableColumn<Row>[];
  rowKey: keyof Row & string;
  /** Rendered instead of the table when `rows` is empty. A string becomes its title. */
  emptyState?: React.ReactNode;
  onRowClick?: (row: Row) => void;
  /** Per-row destinations, indexed like `rows`. `null` leaves that row inert. */
  hrefs?: (string | null)[];
  /** Turns the card heading into a link to the full list. */
  seeAllHref?: string;
  seeAllLabel?: string;
  /** Server-prerendered cell content, same shape as `DataTable.prerenderedCells`. */
  prerenderedCells?: (React.ReactNode | undefined)[][];
  /** SSE channel(s) to subscribe to. */
  realtime?: RealtimeChannels;
}

export function TableWidget<Row extends Record<string, unknown>>(props: TableWidgetProps<Row>) {
  const navigate = useRowNavigation();
  const { hrefs, rows, emptyState } = props;
  const hrefByRow = React.useMemo(
    () => new Map(hrefs ? rows.map((row, index) => [row, hrefs[index] ?? null]) : []),
    [rows, hrefs],
  );
  const onRowClick = hrefs
    ? (row: Row) => {
        const href = hrefByRow.get(row);
        if (href) navigate(href);
      }
    : props.onRowClick;
  const customEmpty =
    rows.length === 0 && emptyState !== undefined && typeof emptyState !== "string";

  return (
    <Card className="h-full overflow-hidden">
      {props.label || props.seeAllHref ? (
        <CardHeader className="flex items-center justify-between gap-3">
          <span className="truncate">{props.label}</span>
          {props.seeAllHref ? (
            <a
              href={props.seeAllHref}
              className="shrink-0 text-xs font-normal text-fp-accent hover:underline"
            >
              {props.seeAllLabel}
            </a>
          ) : null}
        </CardHeader>
      ) : null}
      {customEmpty ? (
        <CardContent
          className={props.label ? "pt-0 text-xs text-fp-text-3" : "text-xs text-fp-text-3"}
        >
          {emptyState}
        </CardContent>
      ) : (
        <DataTable
          className="rounded-none border-0 shadow-none"
          rows={rows}
          columns={props.columns}
          rowKey={props.rowKey}
          total={rows.length}
          page={1}
          pageSize={rows.length}
          {...(onRowClick ? { onRowClick } : {})}
          {...(props.prerenderedCells ? { prerenderedCells: props.prerenderedCells } : {})}
          {...(typeof emptyState === "string" ? { emptyTitle: emptyState } : {})}
        />
      )}
      {props.realtime ? <RealtimeRefresh channels={props.realtime} /> : null}
    </Card>
  );
}
