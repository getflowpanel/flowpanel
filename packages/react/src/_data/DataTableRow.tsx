"use client";
import type * as React from "react";
import { cn } from "../lib/cn.js";
import { ArrayCell } from "./ArrayCell.js";
import type { DataTableColumn } from "./data-table-types.js";
import { ALIGN_CLASS, renderCellValue } from "./format-cell.js";
import { InlineEditCell } from "./InlineEditCell.js";
import { JsonCell } from "./JsonCell.js";
import type { PinMeta } from "./useColumnLayout.js";

function renderCellContent<Row extends Record<string, unknown>>(
  c: DataTableColumn<Row>,
  r: Row,
  rowKey: keyof Row & string,
  prerendered: React.ReactNode | undefined,
  inlineEditResource: string | undefined,
): React.ReactNode {
  if (c.editable && inlineEditResource) {
    // Inline-edit wins over prerendered / specialized renderers — the user
    // opted in via `editable: true` and expects the cell to behave like a
    // spreadsheet input, not a chip / link / popover.
    const rowId = String(r[rowKey] ?? "");
    return (
      <InlineEditCell
        resource={inlineEditResource}
        id={rowId}
        field={c.field}
        value={r[c.field]}
        {...(c.type ? { valueType: c.type } : {})}
      />
    );
  }
  if (prerendered !== undefined) return prerendered;
  if (c.render) return c.render(r);
  if (c.type === "array") {
    const v = r[c.field];
    return <ArrayCell value={Array.isArray(v) ? (v as ReadonlyArray<unknown>) : null} />;
  }
  if (c.type === "json") return <JsonCell value={r[c.field]} />;
  return renderCellValue(r[c.field]);
}

export interface DataTableRowProps<Row extends Record<string, unknown>> {
  row: Row;
  rowIndex: number;
  rowKeyValue: string;
  rowKey: keyof Row & string;
  active: boolean;
  orderedVisible: DataTableColumn<Row>[];
  pinMeta: Map<string, PinMeta>;
  colIndexByField: Map<string, number>;
  prerenderedCells?: (React.ReactNode | undefined)[][];
  rowPadding: string;
  cellText: string;
  selectionEnabled: boolean;
  selectionSet: Set<string>;
  inlineEditResource?: string;
  onRowClick?: (row: Row) => void;
  onToggleRow: (id: string) => void;
  rowEndCell?: (row: Row, rowIndex: number) => React.ReactNode;
}

export function DataTableRow<Row extends Record<string, unknown>>({
  row,
  rowIndex,
  rowKeyValue,
  rowKey,
  active,
  orderedVisible,
  pinMeta,
  colIndexByField,
  prerenderedCells,
  rowPadding,
  cellText,
  selectionEnabled,
  selectionSet,
  inlineEditResource,
  onRowClick,
  onToggleRow,
  rowEndCell,
}: DataTableRowProps<Row>) {
  const isSelected = selectionEnabled && selectionSet.has(rowKeyValue);
  return (
    <tr
      aria-rowindex={rowIndex + 1}
      aria-selected={selectionEnabled ? isSelected : undefined}
      onClick={() => onRowClick?.(row)}
      className={cn(
        "border-t border-fp-border-1 text-fp-text-1 transition-colors",
        onRowClick && "cursor-pointer hover:bg-fp-bg-2",
        active && "bg-fp-bg-2",
      )}
    >
      {selectionEnabled ? (
        <td className={cn("px-4", rowPadding)}>
          <input
            type="checkbox"
            checked={selectionSet.has(rowKeyValue)}
            aria-label={`Select row ${rowKeyValue}`}
            onChange={(e) => {
              e.stopPropagation();
              onToggleRow(rowKeyValue);
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 accent-fp-accent"
          />
        </td>
      ) : null}
      {orderedVisible.map((c) => {
        const meta = pinMeta.get(c.field) ?? { side: "none" as const, offset: 0 };
        const cssVars: Record<string, string> = {};
        if (meta.side === "left") cssVars["--fp-col-pin-left"] = `${meta.offset}px`;
        else if (meta.side === "right") cssVars["--fp-col-pin-right"] = `${meta.offset}px`;
        const originalColIdx = colIndexByField.get(c.field);
        const prerendered =
          prerenderedCells && originalColIdx !== undefined
            ? prerenderedCells[rowIndex]?.[originalColIdx]
            : undefined;
        const cellContent = renderCellContent(c, row, rowKey, prerendered, inlineEditResource);
        return (
          <td
            key={c.field}
            {...(Object.keys(cssVars).length > 0 ? { style: cssVars as React.CSSProperties } : {})}
            className={cn(
              "px-4",
              rowPadding,
              cellText,
              ALIGN_CLASS[c.align ?? "left"],
              meta.side === "left" && "sticky left-[var(--fp-col-pin-left)] bg-fp-bg-1 z-[1]",
              meta.side === "right" && "sticky right-[var(--fp-col-pin-right)] bg-fp-bg-1 z-[1]",
              c.className,
            )}
          >
            {cellContent}
          </td>
        );
      })}
      {rowEndCell ? (
        <td className={cn("px-4", rowPadding, "text-right")}>{rowEndCell(row, rowIndex)}</td>
      ) : null}
    </tr>
  );
}
