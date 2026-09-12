"use client";
import type { ResolvedFormatting } from "@flowpanel/core/format";
import { formatLabel } from "@flowpanel/core/labels";
import * as React from "react";
import { useFormatting } from "../_provider/FormattingContext";
import { useLabels } from "../_provider/LabelsContext";
import { cn } from "../lib/cn";
import { resolveFieldLabel } from "../lib/humanize";
import { Checkbox } from "../ui/checkbox";
import type { DataTableColumn } from "./data-table-types";
import { renderDefaultCell } from "./render-default-cell";

export interface MobileCardListProps<Row> {
  columns: DataTableColumn<Row>[];
  colIndexByField?: Map<string, number>;
  rows: Row[];
  rowKey: keyof Row & string;
  getRowKey?: (row: Row) => string;
  prerenderedCells?: (React.ReactNode | undefined)[][];
  onRowClick?: (row: Row) => void;
  selection?: string[];
  onSelectionChange?: (ids: string[]) => void;
  rowEndCell?: (row: Row, rowIndex: number) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  emptyIcon?: React.ReactNode;
  className?: string;
  enteringRowKeys?: string[];
}

export function MobileCardList<Row extends Record<string, unknown>>({
  columns,
  colIndexByField,
  rows,
  rowKey,
  getRowKey,
  prerenderedCells,
  onRowClick,
  selection,
  onSelectionChange,
  rowEndCell,
  emptyTitle,
  emptyDescription,
  emptyAction,
  emptyIcon,
  className,
  enteringRowKeys = [],
}: MobileCardListProps<Row>) {
  const labels = useLabels();
  const formatting = useFormatting();
  const visible = React.useMemo(() => columns.filter((c) => !c.hidden), [columns]);
  const colIndex = React.useMemo(() => {
    if (colIndexByField) return colIndexByField;
    const m = new Map<string, number>();
    columns.forEach((c, i) => {
      m.set(c.field, i);
    });
    return m;
  }, [colIndexByField, columns]);

  const selectionEnabled = onSelectionChange !== undefined;
  const selectionSet = React.useMemo(() => new Set(selection ?? []), [selection]);
  const enteringKeySet = React.useMemo(() => new Set(enteringRowKeys), [enteringRowKeys]);

  // Same identity rule as the table: a row without an identifier still renders,
  // but nothing that would send its identity anywhere is offered on it.
  const identityOf = React.useCallback(
    (row: Row): string | null => {
      if (getRowKey) return getRowKey(row) || null;
      const raw = row[rowKey];
      if (typeof raw === "string") return raw || null;
      if (typeof raw === "number" || typeof raw === "bigint") return String(raw);
      return null;
    },
    [getRowKey, rowKey],
  );

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-fp border border-fp-border-1 bg-fp-bg-1 px-6 py-16 text-center",
          className,
        )}
      >
        {emptyIcon ? (
          <div
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-fp-bg-2 text-2xl text-fp-text-2"
            aria-hidden="true"
          >
            {emptyIcon}
          </div>
        ) : null}
        <div className="text-base font-medium text-fp-text-1">{emptyTitle ?? labels.noResults}</div>
        {emptyDescription ? (
          <div className="mt-1 text-sm text-fp-text-3">{emptyDescription}</div>
        ) : null}
        {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
      </div>
    );
  }

  const [titleCol, ...restCols] = visible;

  return (
    <ul className={cn("space-y-2", className)}>
      {rows.map((r, idx) => {
        const identity = identityOf(r);
        const key = identity ?? `\u0000${idx}`;
        const entering = identity !== null && enteringKeySet.has(identity);
        const isSelected = selectionEnabled && identity !== null && selectionSet.has(identity);

        const interactive = Boolean(onRowClick) && identity !== null;
        const onKeyDown = interactive
          ? (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onRowClick?.(r);
              }
            }
          : undefined;
        return (
          <li
            key={key}
            className={cn(
              "rounded-fp border border-fp-border-1 bg-fp-bg-1 transition-colors",
              interactive && "active:bg-fp-bg-2",
              isSelected && "ring-2 ring-fp-focus/40",
              entering && "fp-row-enter",
            )}
          >
            <div
              {...(interactive
                ? {
                    role: "button",
                    tabIndex: 0,
                    onClick: () => onRowClick?.(r),
                    onKeyDown,
                    "aria-label": `Open ${titleCol ? String(r[titleCol.field]) : (identity ?? key)}`,
                  }
                : {})}
              className={cn(
                "w-full px-4 py-3 text-left",
                interactive &&
                  "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  {selectionEnabled ? (
                    <Checkbox
                      checked={isSelected}
                      disabled={identity === null}
                      onCheckedChange={() => {
                        if (identity === null) return;
                        const next = new Set(selectionSet);
                        if (next.has(identity)) next.delete(identity);
                        else next.add(identity);
                        onSelectionChange?.(Array.from(next));
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={formatLabel(labels.table.selectRow, { id: identity ?? "" })}
                      className="-ml-3 -mt-2 h-11 w-11 shrink-0 sm:ml-0 sm:mt-1 sm:h-5 sm:w-5"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    {titleCol ? (
                      <div className="truncate text-base font-medium text-fp-text-1">
                        {renderCell(titleCol, r, idx, prerenderedCells, colIndex, formatting)}
                      </div>
                    ) : null}
                    {restCols.length > 0 ? (
                      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
                        {restCols.map((c) => (
                          <React.Fragment key={c.field}>
                            <dt className="text-fp-text-3">
                              {resolveFieldLabel(c.label, c.field)}
                            </dt>
                            <dd className="min-w-0 truncate text-fp-text-1">
                              {renderCell(c, r, idx, prerenderedCells, colIndex, formatting)}
                            </dd>
                          </React.Fragment>
                        ))}
                      </dl>
                    ) : null}
                  </div>
                </div>
                {rowEndCell ? (
                  // biome-ignore lint/a11y/noStaticElementInteractions: stop-propagation guard around an interactive child, not a control itself.
                  <div
                    role="presentation"
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    {rowEndCell(r, idx)}
                  </div>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function renderCell<Row extends Record<string, unknown>>(
  c: DataTableColumn<Row>,
  r: Row,
  rowIdx: number,
  prerenderedCells: MobileCardListProps<Row>["prerenderedCells"],
  colIndexByField: Map<string, number>,
  formatting: ResolvedFormatting,
): React.ReactNode {
  const originalIdx = colIndexByField.get(c.field);
  const pre =
    prerenderedCells && originalIdx !== undefined
      ? prerenderedCells[rowIdx]?.[originalIdx]
      : undefined;
  if (pre !== undefined) return pre;
  if (c.render) return c.render(r);
  return renderDefaultCell(c, r, formatting);
}
