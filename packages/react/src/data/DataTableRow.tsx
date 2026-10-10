"use client";
import type { ResolvedFormatting } from "@flowpanel/core/format";
import { formatLabel } from "@flowpanel/core/labels";
import type * as React from "react";
import { cn } from "../lib/cn";
import { useFormatting } from "../provider/FormattingContext";
import { useLabels } from "../provider/LabelsContext";
import { Checkbox } from "../ui/checkbox";
import type { DataTableColumn } from "./data-table-types";
import { ALIGN_CLASS } from "./format-cell";
import { InlineEditCell } from "./InlineEditCell";
import { renderDefaultCell, withSecondary } from "./render-default-cell";
import type { PinMeta } from "./useColumnLayout";

function renderCellContent<Row extends Record<string, unknown>>(
  c: DataTableColumn<Row>,
  r: Row,
  rowId: string | null,
  prerendered: React.ReactNode | undefined,
  inlineEditResource: string | undefined,
  formatting: ResolvedFormatting,
  rowClickable: boolean,
): React.ReactNode {
  // Without an identifier the update request has no row to address.
  if (c.editable && inlineEditResource && rowId !== null) {
    return (
      <InlineEditCell
        resource={inlineEditResource}
        id={rowId}
        field={c.field}
        {...(c.label ? { label: c.label } : {})}
        value={r[c.field]}
        {...(c.type ? { valueType: c.type } : {})}
        rowClickable={rowClickable}
      />
    );
  }
  if (prerendered !== undefined) return prerendered;
  if (c.render) return c.render(r);
  return renderDefaultCell(c, r, formatting);
}

export interface DataTableRowProps<Row extends Record<string, unknown>> {
  row: Row;
  rowIndex: number;
  rowKeyValue: string | null;
  entering?: boolean;
  active: boolean;
  orderedVisible: DataTableColumn<Row>[];
  pinMeta: Map<string, PinMeta>;
  colIndexByField: Map<string, number>;
  prerenderedRow?: (React.ReactNode | undefined)[];
  rowPadding: string;
  selectionEnabled: boolean;
  selectionSet: Set<string>;
  inlineEditResource?: string;
  onRowClick?: (row: Row) => void;
  onToggleRow: (id: string) => void;
  rowEndCell?: (row: Row, rowIndex: number) => React.ReactNode;
  /** The row's position on this page, which the keyboard cursor uses. */
  pageIndex: number;
  /** The last column held at the left edge, which draws the edge line while the table scrolls. */
  lastLeftPin: string | undefined;
}

export function DataTableRow<Row extends Record<string, unknown>>({
  row,
  rowIndex,
  rowKeyValue,
  entering,
  active,
  orderedVisible,
  pinMeta,
  colIndexByField,
  prerenderedRow,
  rowPadding,
  selectionEnabled,
  selectionSet,
  inlineEditResource,
  onRowClick,
  onToggleRow,
  rowEndCell,
  pageIndex,
  lastLeftPin,
}: DataTableRowProps<Row>) {
  const labels = useLabels();
  const formatting = useFormatting();
  const isSelected = selectionEnabled && rowKeyValue !== null && selectionSet.has(rowKeyValue);
  return (
    <tr
      aria-rowindex={rowIndex + 2}
      aria-current={active ? "true" : undefined}
      tabIndex={-1}
      data-fp-row=""
      data-fp-row-index={pageIndex}
      {...(rowKeyValue !== null ? { "data-fp-row-key": rowKeyValue } : {})}
      {...(onRowClick ? { "data-clickable": "" } : {})}
      {...(isSelected ? { "data-selected": "" } : {})}
      onClick={() => onRowClick?.(row)}
      className={cn(
        "fp-group/row fp-border-t fp-border-line fp-text-ink focus:fp-outline-none",
        onRowClick && "fp-cursor-pointer",
        entering && "fp-row-enter",
      )}
    >
      {selectionEnabled ? (
        <td className={cn("fp-sticky fp-left-0 fp-z-[1] fp-bg-surface fp-px-4", rowPadding)}>
          <Checkbox
            checked={isSelected}
            disabled={rowKeyValue === null}
            aria-label={formatLabel(labels.table.selectRow, { id: rowKeyValue ?? "" })}
            onCheckedChange={() => rowKeyValue !== null && onToggleRow(rowKeyValue)}
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
          originalColIdx !== undefined ? prerenderedRow?.[originalColIdx] : undefined;
        const cellContent = renderCellContent(
          c,
          row,
          rowKeyValue,
          prerendered,
          inlineEditResource,
          formatting,
          onRowClick !== undefined,
        );
        return (
          <td
            key={c.field}
            dir="auto"
            data-fp-cell=""
            {...(meta.side === "left" && lastLeftPin === c.field ? { "data-fp-pin-edge": "" } : {})}
            {...(Object.keys(cssVars).length > 0 ? { style: cssVars as React.CSSProperties } : {})}
            className={cn(
              "fp-overflow-hidden fp-text-ellipsis fp-whitespace-nowrap fp-px-4",
              rowPadding,
              ALIGN_CLASS[c.align ?? "left"],
              c.align === "right" && "fp-tabular-nums",
              meta.side === "left" &&
                "fp-sticky fp-left-[var(--fp-col-pin-left)] fp-z-[1] fp-bg-surface",
              meta.side === "right" &&
                "fp-sticky fp-right-[var(--fp-col-pin-right)] fp-z-[1] fp-bg-surface",
              c.className,
            )}
          >
            {withSecondary(c, row, cellContent, formatting)}
          </td>
        );
      })}
      {rowEndCell ? (
        <td className={cn("fp-px-4", rowPadding, "fp-text-right")}>{rowEndCell(row, rowIndex)}</td>
      ) : null}
    </tr>
  );
}
