"use client";
import {
  DataTable,
  type DataTableColumn,
  type DataTableDensity,
  type DataTableSort,
  type RealtimeChannels,
  RealtimeRefresh,
  useAdminDrawer,
  useRowHrefClick,
} from "@flowpanel/react";
import type { ReactNode } from "react";
import * as React from "react";
import { BulkActionsBar } from "../actions/BulkActionsBar";
import type { SerializedBulkAction } from "../actions/bulk-action";
import { RestoreButton } from "../actions/RestoreButton";
import { RowActionsMenu } from "../actions/RowActionsMenu";
import type { SerializedRowAction } from "../actions/row-action";
import { useListNavigation } from "../pages/list-navigation";
import { rowIdentity } from "../runtime/row-identity";
import { rememberRowCells } from "./table-cells";

/** Thin wrapper around `<DataTable>` that wires realtime refresh and row-click drawer interaction. */
export interface DataTableWithDrawerRowsProps<Row extends Record<string, unknown>> {
  resource: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  total: number;
  page: number;
  pageSize: number;
  /** Sizes offered by the pager; the server clamps `?pageSize=` to this set. */
  pageSizeOptions?: number[];
  rowKey: keyof Row & string;
  sort?: DataTableSort<Row> | null;
  /** Initial row density from `resource.options.density`. Forwarded to `DataTable`. */
  density?: DataTableDensity;
  /** Export affordance from `resource.options.export`; the export runs on the server for `resource`. */
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
  /** Per-row detail destinations, indexed like `rows`. `null` leaves that row inert. */
  rowHrefs?: (string | null)[];
  /** SSE channel(s) to subscribe to for live refresh. */
  realtime?: RealtimeChannels;
  /** Keys that receive the subtle one-shot created-row entry treatment. */
  enteringRowKeys?: string[];
  /** Marker copied from `fp_created`; consumed from the visible URL after paint. */
  createdRowKey?: string;
  /** What one row is, mid-sentence, for the phone card's link: "Open customer Ann". */
  rowLabel?: string;
}

export function DataTableWithDrawerRows<Row extends Record<string, unknown>>(
  props: DataTableWithDrawerRowsProps<Row>,
) {
  const {
    resource,
    rows,
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
    rowHrefs,
    realtime,
    createdRowKey,
    ...rest
  } = props;
  const { open } = useAdminDrawer();
  const { navigate, pending } = useListNavigation();
  const hrefClick = useRowHrefClick(rows, rowHrefs);
  const onRowClick = openDrawerOnRowClick
    ? (row: Row) => {
        const id = rowIdentity(row, rowKey);
        if (id === null) return;
        const cells = prerenderedCells?.[rows.indexOf(row)] ?? [];
        rememberRowCells(
          resource,
          id,
          Object.fromEntries(rest.columns.map((column, index) => [column.field, cells[index]])),
        );
        open({ resource, id });
      }
    : hrefClick;

  const hasRowActions = rowActions && rowActions.length > 0;
  const hasBulkActions = bulkActions && bulkActions.length > 0;
  const deletedRowKeySet = deletedRowKeys && deletedRowKeys.length > 0 ? deletedRowKeys : undefined;
  const hasRestore = !!deletedRowKeySet;

  const [selection, setSelection] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!createdRowKey || typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("fp_created") !== createdRowKey) return;
    url.searchParams.delete("fp_created");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [createdRowKey]);

  return (
    <>
      {realtime ? <RealtimeRefresh channels={realtime} /> : null}
      <div aria-hidden className="fp-relative fp-h-0">
        {pending ? (
          <span className="fp-pending-bar fp-absolute fp-inset-x-2 fp-top-0 fp-z-10 fp-h-[2px] fp-rounded-full" />
        ) : null}
      </div>
      {hasBulkActions ? (
        <BulkActionsBar
          resource={resource}
          selection={
            deletedRowKeySet ? selection.filter((id) => !deletedRowKeySet.includes(id)) : selection
          }
          onClear={() => setSelection([])}
          actions={bulkActions as SerializedBulkAction[]}
        />
      ) : null}
      <DataTable
        {...rest}
        rows={rows}
        rowKey={rowKey}
        {...(sort ? { sort } : {})}
        {...(emptyTitle ? { emptyTitle } : {})}
        {...(emptyDescription ? { emptyDescription } : {})}
        {...(emptyAction ? { emptyAction } : {})}
        {...(emptyIcon ? { emptyIcon } : {})}
        {...(prerenderedCells ? { prerenderedCells } : {})}
        onSortChange={(s) =>
          navigate((q) => {
            if (s) q.set("sort", `${String(s.field)}:${s.dir}`);
            else q.delete("sort");
          }, "push")
        }
        onPageChange={(p) => navigate((q) => q.set("page", String(p)), "push", { scroll: true })}
        onPageSizeChange={(n) =>
          navigate(
            (q) => {
              if (n == null) q.delete("pageSize");
              else q.set("pageSize", String(n));
              q.delete("page");
            },
            "push",
            { scroll: true },
          )
        }
        inlineEditResource={resource}
        {...(rest.exportable
          ? {
              exportable: {
                ...(rest.exportable === true ? {} : rest.exportable),
                resource,
              },
            }
          : {})}
        {...(hasBulkActions ? { selection, onSelectionChange: setSelection } : {})}
        {...(onRowClick ? { onRowClick } : {})}
        {...(hasRowActions || hasRestore
          ? {
              rowEndCell: (row: Row) => {
                const idStr = rowIdentity(row, rowKey);
                if (idStr === null) return null;
                const acts = hasRowActions
                  ? (rowActionsById?.[idStr] ?? (rowActions as SerializedRowAction[]))
                  : [];
                const isDeleted = deletedRowKeySet?.includes(idStr) ?? false;
                if (!isDeleted) {
                  if (acts.length === 0) return null;
                  return <RowActionsMenu resource={resource} id={idStr} actions={acts} />;
                }
                return (
                  <div className="fp-flex fp-items-center fp-justify-end fp-gap-1">
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
