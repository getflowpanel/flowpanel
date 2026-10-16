"use client";
import type { ResolvedFormatting } from "@flowpanel/core/format";
import { formatLabel } from "@flowpanel/core/labels";
import * as React from "react";
import type { EmptyStateProps } from "../feedback/EmptyStateDefault";
import { cn } from "../lib/cn";
import { withEmailBreaks } from "../lib/email-breaks";
import { useComponent } from "../provider/ComponentsContext";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { Checkbox } from "../ui/checkbox";
import { columnLabel } from "./column-label";
import type { DataTableColumn } from "./data-table-types";
import { renderDefaultCell, withSecondary } from "./render-default-cell";

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
  /** What one row is, mid-sentence ("run"), so a card reads "Open run 36". */
  rowLabel?: string;
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
  rowLabel,
}: MobileCardListProps<Row>) {
  const labels = useLabels();
  const formatting = useFormatting();
  const Empty = useComponent("EmptyState", CardEmptyState);
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

  // Same identity rule as the table: a row without an identifier still renders but sends its identity nowhere.
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
          "fp-flex fp-flex-col fp-rounded fp-border fp-border-line fp-bg-surface",
          className,
        )}
      >
        <Empty
          title={emptyTitle ?? labels.table.noResults}
          {...(emptyDescription ? { description: emptyDescription } : {})}
          {...(emptyAction ? { action: emptyAction } : {})}
          {...(emptyIcon ? { icon: emptyIcon } : {})}
        />
      </div>
    );
  }

  // The card's title is its first text column: an id, number, date or badge reads poorly as a heading.
  const at = Math.max(
    0,
    visible.findIndex(
      (c) => c.format === undefined && !["number", "date", "boolean"].includes(c.type ?? ""),
    ),
  );
  const titleCol = visible[at];
  const restCols = visible.filter((_, index) => index !== at);

  return (
    <ul className={cn("fp-space-y-2", className)}>
      {rows.map((r, idx) => {
        const identity = identityOf(r);
        const key = identity ?? `\u0000${idx}`;
        const entering = identity !== null && enteringKeySet.has(identity);
        const isSelected = selectionEnabled && identity !== null && selectionSet.has(identity);
        const interactive = Boolean(onRowClick) && identity !== null;
        const title = titleCol
          ? renderCell(titleCol, r, idx, prerenderedCells, colIndex, formatting)
          : null;
        const titleText = plainTitle(titleCol ? r[titleCol.field] : undefined) ?? identity ?? "";
        return (
          <li
            key={key}
            data-fp-card=""
            className={cn(
              "fp-relative fp-rounded fp-border fp-border-line fp-bg-surface fp-transition-colors",
              interactive && "active:fp-bg-canvas",
              isSelected && "fp-ring-2 fp-ring-focus/60",
              entering && "fp-row-enter",
            )}
          >
            {interactive ? (
              // The whole card opens the row; links and controls inside it sit above this button.
              <button
                type="button"
                data-fp-card-link=""
                onClick={() => onRowClick?.(r)}
                aria-label={formatLabel(labels.table.openRow, {
                  title: rowLabel ? `${rowLabel} ${titleText}` : titleText,
                })}
                className="fp-absolute fp-inset-0 fp-rounded focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60"
              />
            ) : null}
            <div className="fp-flex fp-items-start fp-justify-between fp-gap-2 fp-px-4 fp-py-3">
              <div className="fp-flex fp-min-w-0 fp-items-start fp-gap-2">
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
                    aria-label={formatLabel(labels.table.selectRow, { id: identity ?? "" })}
                    className="-fp-ml-3 -fp-mt-2 fp-h-11 fp-w-11 fp-shrink-0 sm:fp-ml-0 sm:fp-mt-1 sm:fp-h-6 sm:fp-w-6"
                  />
                ) : null}
                <div className="fp-min-w-0 fp-flex-1">
                  {titleCol ? (
                    <div className="fp-line-clamp-2 fp-break-words fp-text-base fp-font-medium fp-text-ink">
                      {title}
                    </div>
                  ) : null}
                  {restCols.length > 0 ? (
                    <dl className="fp-mt-2 fp-grid fp-grid-cols-[max-content_1fr] fp-gap-x-3 fp-gap-y-1 fp-text-sm">
                      {restCols.map((c) => (
                        <React.Fragment key={c.field}>
                          <dt className="fp-text-faint">{columnLabel(c)}</dt>
                          <dd
                            dir="auto"
                            className="fp-min-w-0 fp-break-words fp-text-ink [&_.fp-truncate]:fp-whitespace-normal"
                          >
                            {renderCell(c, r, idx, prerenderedCells, colIndex, formatting)}
                          </dd>
                        </React.Fragment>
                      ))}
                    </dl>
                  ) : null}
                </div>
              </div>
              {rowEndCell ? <div className="fp-shrink-0">{rowEndCell(r, idx)}</div> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** The record's own words for its card's label, when its title cell holds plain text. */
function plainTitle(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
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
  const cell =
    pre !== undefined ? pre : c.render ? c.render(r) : renderDefaultCell(c, r, formatting);
  return withSecondary(c, r, typeof cell === "string" ? withEmailBreaks(cell) : cell, formatting);
}

/** The card list's own empty state, which a host's `EmptyState` slot replaces. */
function CardEmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <div className="fp-flex fp-flex-1 fp-flex-col fp-items-center fp-justify-center fp-px-6 fp-py-16 fp-text-center">
      {icon ? (
        <div
          className="fp-mb-3 fp-flex fp-h-12 fp-w-12 fp-items-center fp-justify-center fp-rounded-full fp-bg-canvas fp-text-2xl fp-text-soft"
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
      <div className="fp-text-base fp-font-medium fp-text-ink">{title}</div>
      {description ? <div className="fp-mt-1 fp-text-sm fp-text-faint">{description}</div> : null}
      {action ? <div className="fp-mt-4">{action}</div> : null}
    </div>
  );
}
