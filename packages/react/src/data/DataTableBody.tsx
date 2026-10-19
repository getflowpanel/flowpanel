"use client";
import * as React from "react";
import { useLabels } from "../provider/LabelsContext";
import { DataTableRow } from "./DataTableRow";
import type { DataTableColumn } from "./data-table-types";
import type { PinMeta } from "./useColumnLayout";

export interface DataTableBodyProps<Row extends Record<string, unknown>> {
  rows: Row[];
  identityOf: (row: Row) => string | null;
  /** The first row's position in the whole result, for `aria-rowindex`. */
  firstRowIndex: number;
  enteringKeySet: ReadonlySet<string>;
  cursor: number;
  setCursor: React.Dispatch<React.SetStateAction<number>>;
  onKeyDown: (event: React.KeyboardEvent<HTMLTableSectionElement>) => void;
  /** Some row opens on Enter, so the body names the keys that move and open. */
  keyboardRows: boolean;
  orderedVisible: DataTableColumn<Row>[];
  pinMeta: Map<string, PinMeta>;
  lastLeftPin: string | undefined;
  /** Columns the reader resized, whose text any width may cut. */
  resized: ReadonlySet<string>;
  colIndexByField: Map<string, number>;
  prerenderedCells?: (React.ReactNode | undefined)[][];
  rowPadding: string;
  selectionEnabled: boolean;
  selectionSet: Set<string>;
  onToggleRow: (id: string) => void;
  inlineEditResource?: string;
  onRowClick?: (row: Row) => void;
  rowEndCell?: (row: Row, rowIndex: number) => React.ReactNode;
}

/** The rows, and the keyboard cursor that moves over them. */
export function DataTableBody<Row extends Record<string, unknown>>({
  rows,
  identityOf,
  firstRowIndex,
  enteringKeySet,
  cursor,
  setCursor,
  onKeyDown,
  keyboardRows,
  orderedVisible,
  pinMeta,
  lastLeftPin,
  resized,
  colIndexByField,
  prerenderedCells,
  rowPadding,
  selectionEnabled,
  selectionSet,
  onToggleRow,
  inlineEditResource,
  onRowClick,
  rowEndCell,
}: DataTableBodyProps<Row>) {
  const labels = useLabels();
  const ref = React.useRef<HTMLTableSectionElement>(null);
  // The cursor carries focus with it, so a drawer it opens gives focus back to that row.
  React.useEffect(() => {
    const body = ref.current;
    const row =
      cursor < 0 ? null : body?.querySelector<HTMLElement>(`[data-fp-row-index="${cursor}"]`);
    if (!body || !row) return;
    const active = document.activeElement;
    if (active === body || (active instanceof HTMLElement && active.matches("tr[data-fp-row]"))) {
      if (active !== row) row.focus({ preventScroll: true });
    }
    row.scrollIntoView?.({ block: "nearest" });
  }, [cursor]);
  return (
    <tbody
      ref={ref}
      {...(inlineEditResource ? { "data-fp-resource": inlineEditResource } : {})}
      onKeyDown={onKeyDown}
      // Land the cursor on the row that took focus, or the first row when the table is tabbed to.
      onFocus={(event) => {
        const row =
          event.target instanceof Element ? event.target.closest("[data-fp-row-index]") : null;
        const index = row ? Number(row.getAttribute("data-fp-row-index")) : -1;
        setCursor((c) => (index >= 0 ? index : c < 0 ? 0 : c));
      }}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: the rows take focus as one stop; j, k and Enter move a cursor over them.
      tabIndex={0}
      aria-label={keyboardRows ? labels.table.rowsHint : labels.table.rowsReadOnlyHint}
      className="focus:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60 focus-visible:fp-ring-inset"
    >
      {rows.map((r, idx) => {
        // A row the projection could not identify still renders, but nothing sends its identity anywhere.
        const identity = identityOf(r);
        return (
          <DataTableRow<Row>
            key={identity ?? `\u0000${idx}`}
            row={r}
            rowIndex={firstRowIndex + idx}
            pageIndex={idx}
            rowKeyValue={identity}
            entering={identity !== null && enteringKeySet.has(identity)}
            active={idx === cursor}
            orderedVisible={orderedVisible}
            pinMeta={pinMeta}
            lastLeftPin={lastLeftPin}
            resized={resized}
            colIndexByField={colIndexByField}
            {...(prerenderedCells?.[idx] ? { prerenderedRow: prerenderedCells[idx] } : {})}
            rowPadding={rowPadding}
            selectionEnabled={selectionEnabled}
            selectionSet={selectionSet}
            {...(inlineEditResource ? { inlineEditResource } : {})}
            {...(onRowClick && identity !== null
              ? {
                  onRowClick: (row: Row) => {
                    setCursor(idx);
                    onRowClick(row);
                  },
                }
              : {})}
            onToggleRow={onToggleRow}
            {...(rowEndCell ? { rowEndCell } : {})}
          />
        );
      })}
    </tbody>
  );
}
