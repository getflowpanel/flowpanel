"use client";
import type * as React from "react";
import { cn } from "../lib/cn";
import { Checkbox } from "../ui/checkbox";
import type { DataTableColumn } from "./data-table-types";
import { ALIGN_CLASS } from "./format-cell";
import { InlineEditCell } from "./InlineEditCell";
import { renderDefaultCell } from "./render-default-cell";
import type { PinMeta } from "./useColumnLayout";

function renderCellContent<Row extends Record<string, unknown>>(
  c: DataTableColumn<Row>,
  r: Row,
  rowKey: keyof Row & string,
  prerendered: React.ReactNode | undefined,
  inlineEditResource: string | undefined,
): React.ReactNode {
  if (c.editable && inlineEditResource) {
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
  return renderDefaultCell(c, r);
}

export interface DataTableRowProps<Row extends Record<string, unknown>> {
  row: Row;
  rowIndex: number;
  rowKeyValue: string;
  entering?: boolean;
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
  entering,
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
      aria-current={active ? "true" : undefined}
      onClick={() => onRowClick?.(row)}
      className={cn(
        // Not `transition-colors`: that list includes `outline-color`, and the
        // cursor outline flips from style:none to solid instantly while its
        // colour interpolates from the inherited near-white — a white ring that
        // fades to the accent on every cursor move.
        "border-t border-fp-border-1 text-fp-text-1 transition-[background-color]",
        onRowClick && "cursor-pointer hover:bg-fp-bg-2/70",
        isSelected && "bg-fp-accent/5",
        active && "bg-fp-accent/5 outline outline-2 -outline-offset-2 outline-fp-focus/60",
        entering && "fp-row-enter",
      )}
    >
      {selectionEnabled ? (
        <td className={cn("px-4", rowPadding)}>
          <Checkbox
            checked={selectionSet.has(rowKeyValue)}
            aria-label={`Select row ${rowKeyValue}`}
            onCheckedChange={() => onToggleRow(rowKeyValue)}
            onClick={(e) => e.stopPropagation()}
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
              c.align === "right" && "tabular-nums",
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
