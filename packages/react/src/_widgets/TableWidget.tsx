"use client";
import type { WidgetCaption } from "@flowpanel/core";
import type * as React from "react";
import { DataTable, type DataTableColumn } from "../_data/DataTable";
import { Card, CardContent, CardHeader } from "../_layout/Card";
import { useLabels } from "../_provider/LabelsContext";
import type { RealtimeChannels } from "../hooks/useRealtimeRefresh";
import { RealtimeRefresh } from "../hooks/useRealtimeRefresh";
import { useRowHrefClick } from "../hooks/useRowNavigation";
import { QUIET_LINK } from "../lib/label-text";
import { CaptionLine } from "./CaptionLine";
import { EmptyLine } from "./EmptyLine";

export interface TableWidgetProps<Row extends Record<string, unknown>> {
  label?: string;
  rows: Row[];
  columns: DataTableColumn<Row>[];
  rowKey: keyof Row & string;
  /** One line in place of the table when `rows` is empty. Default: `labels.widget.empty`. */
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
  /** The line under the title: a cut range, freshness or coverage. */
  caption?: WidgetCaption;
  /** `"compact"` sets 40px rows. */
  density?: "comfortable" | "compact";
}

export function TableWidget<Row extends Record<string, unknown>>(props: TableWidgetProps<Row>) {
  const { hrefs, rows, emptyState } = props;
  const { widget } = useLabels();
  const onRowClick = useRowHrefClick(rows, hrefs) ?? props.onRowClick;

  return (
    <Card className="h-full overflow-hidden">
      {props.label || props.seeAllHref || props.caption ? (
        <CardHeader className="flex items-center justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate">{props.label}</span>
            <CaptionLine caption={props.caption} />
          </span>
          {props.seeAllHref ? (
            <a href={props.seeAllHref} className={`shrink-0 text-xs font-normal ${QUIET_LINK}`}>
              {props.seeAllLabel}
            </a>
          ) : null}
        </CardHeader>
      ) : null}
      {rows.length === 0 ? (
        <CardContent className={props.label || props.caption ? "pt-0" : ""}>
          <EmptyLine>{emptyState ?? widget.empty}</EmptyLine>
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
          {...(props.density ? { density: props.density } : {})}
          {...(props.prerenderedCells ? { prerenderedCells: props.prerenderedCells } : {})}
        />
      )}
      {props.realtime ? <RealtimeRefresh channels={props.realtime} /> : null}
    </Card>
  );
}
