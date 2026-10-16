"use client";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import * as React from "react";
import { cn } from "../lib/cn";
import { LABEL_TEXT } from "../lib/label-text";
import { useLabels } from "../provider/LabelsContext";
import { Checkbox } from "../ui/checkbox";
import { ColumnPinMenu } from "./ColumnPinMenu";
import { ColumnResizer } from "./ColumnResizer";
import { columnLabel } from "./column-label";
import { SELECTION_WIDTH_PX } from "./column-sizing";
import type { DataTableColumn, DataTableSort } from "./data-table-types";
import { ALIGN_CLASS } from "./format-cell";
import type { PinMeta } from "./useColumnLayout";

export interface DataTableHeaderProps<Row> {
  orderedVisible: DataTableColumn<Row>[];
  sort?: DataTableSort<Row> | null;
  pinMeta: Map<string, PinMeta>;
  effectiveWidths: Record<string, number>;
  /** Each column's width. */
  widths: ReadonlyMap<string, string>;
  leftPins: string[];
  rightPins: string[];
  selectionEnabled: boolean;
  allOnPageSelected: boolean;
  someOnPageSelected: boolean;
  onToggleAll: () => void;
  onHeaderClick: (c: DataTableColumn<Row>) => void;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  onPinnedColumnsChange?: (pinned: { left?: string[]; right?: string[] }) => void;
  resizingRef: React.MutableRefObject<{ field: string; base: number } | null>;
  liveWidthsRef: React.MutableRefObject<Record<string, number>>;
  setLiveWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  /** The trailing column's width, when the table has one. */
  rowEndWidth?: string | undefined;
  rowEndCellLabel: string;
}

export function DataTableHeader<Row>({
  orderedVisible,
  sort,
  pinMeta,
  effectiveWidths,
  widths,
  leftPins,
  rightPins,
  selectionEnabled,
  allOnPageSelected,
  someOnPageSelected,
  onToggleAll,
  onHeaderClick,
  onColumnWidthsChange,
  onPinnedColumnsChange,
  resizingRef,
  liveWidthsRef,
  setLiveWidths,
  rowEndWidth,
  rowEndCellLabel,
}: DataTableHeaderProps<Row>) {
  const labels = useLabels();
  const headCells = React.useRef(new Map<string, HTMLTableCellElement>());
  const lastLeftPin = [...orderedVisible]
    .reverse()
    .find((c) => pinMeta.get(c.field)?.side === "left")?.field;
  return (
    <thead className={LABEL_TEXT}>
      <tr className="fp-border-b fp-border-line">
        {selectionEnabled ? (
          <th
            scope="col"
            style={{ width: SELECTION_WIDTH_PX }}
            className="fp-sticky fp-left-0 fp-top-0 fp-z-[4] fp-bg-surface fp-px-4 fp-py-2"
          >
            <Checkbox
              className="sm:fp-flex"
              checked={allOnPageSelected ? true : someOnPageSelected ? "indeterminate" : false}
              aria-label={allOnPageSelected ? labels.table.deselectAll : labels.table.selectAll}
              onCheckedChange={() => onToggleAll()}
            />
          </th>
        ) : null}
        {orderedVisible.map((c) => {
          const active = sort?.field === c.field;
          const ariaSort: React.AriaAttributes["aria-sort"] = active
            ? sort?.dir === "asc"
              ? "ascending"
              : "descending"
            : "none";
          const width = widths.get(c.field);
          const meta = pinMeta.get(c.field) ?? { side: "none" as const, offset: 0 };
          const style: Record<string, string> = {};
          if (width !== undefined) style.width = width;
          if (meta.side === "left") style["--fp-col-pin-left"] = `${meta.offset}px`;
          else if (meta.side === "right") style["--fp-col-pin-right"] = `${meta.offset}px`;
          const arrow = cn(
            "fp-h-3 fp-w-3 fp-shrink-0",
            c.align === "right" ? "fp-mr-1" : "fp-ml-1",
          );
          // Without a pin button beside it, the button reaches into the padding, so its arrow takes none of the label's width.
          const reach = onPinnedColumnsChange
            ? "fp-max-w-full"
            : cn("fp-max-w-[calc(100%+1rem)]", c.align === "right" ? "-fp-ml-4" : "-fp-mr-4");
          const currentPin: "left" | "right" | null =
            meta.auto || meta.side === "none" ? null : meta.side;
          return (
            <th
              key={c.field}
              ref={(node) => {
                if (node) headCells.current.set(c.field, node);
                else headCells.current.delete(c.field);
              }}
              scope="col"
              data-fp-col={c.field}
              aria-sort={c.sortable ? ariaSort : undefined}
              {...(Object.keys(style).length > 0 ? { style: style as React.CSSProperties } : {})}
              {...(meta.side === "left" && lastLeftPin === c.field
                ? { "data-fp-pin-edge": "" }
                : {})}
              className={cn(
                "fp-group fp-overflow-hidden fp-text-ellipsis fp-whitespace-nowrap fp-bg-surface fp-px-4 fp-py-2.5 fp-font-normal fp-select-none",
                ALIGN_CLASS[c.align ?? "left"],
                meta.side === "left" &&
                  "fp-sticky fp-left-[var(--fp-col-pin-left)] fp-top-0 fp-z-[4]",
                meta.side === "right" &&
                  "fp-sticky fp-right-[var(--fp-col-pin-right)] fp-top-0 fp-z-[4]",
                meta.side === "none" && "fp-sticky fp-top-0 fp-z-[3]",
                c.className,
              )}
            >
              {c.sortable ? (
                <button
                  type="button"
                  onClick={() => onHeaderClick(c)}
                  className={cn(
                    "-fp-my-1 fp-inline-flex fp-items-center fp-rounded-sm fp-py-1 fp-transition-colors hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-inset focus-visible:fp-ring-focus/60",
                    reach,
                    c.align === "right" && "fp-flex-row-reverse",
                    active && "fp-text-ink",
                  )}
                >
                  <span className="fp-truncate">{columnLabel(c)}</span>
                  {active ? (
                    sort?.dir === "asc" ? (
                      <ArrowUp aria-hidden className={arrow} />
                    ) : (
                      <ArrowDown aria-hidden className={arrow} />
                    )
                  ) : (
                    <ChevronsUpDown
                      aria-hidden
                      className={cn(
                        arrow,
                        "fp-opacity-0 fp-transition-opacity group-hover:fp-opacity-60",
                      )}
                    />
                  )}
                </button>
              ) : (
                columnLabel(c)
              )}
              {onPinnedColumnsChange ? (
                <ColumnPinMenu
                  field={c.field}
                  currentPin={currentPin}
                  onPin={(side) => {
                    const nextLeft = leftPins.filter((f) => f !== c.field);
                    const nextRight = rightPins.filter((f) => f !== c.field);
                    if (side === "left") nextLeft.push(c.field);
                    if (side === "right") nextRight.push(c.field);
                    onPinnedColumnsChange({ left: nextLeft, right: nextRight });
                  }}
                />
              ) : null}
              {onColumnWidthsChange ? (
                <ColumnResizer
                  onResize={(delta) => {
                    const currentBase =
                      resizingRef.current?.field === c.field
                        ? resizingRef.current.base
                        : (effectiveWidths[c.field] ??
                          headCells.current.get(c.field)?.getBoundingClientRect().width ??
                          120);
                    if (resizingRef.current?.field !== c.field) {
                      resizingRef.current = { field: c.field, base: currentBase };
                    }
                    setLiveWidths((w) => ({
                      ...w,
                      [c.field]: Math.max(40, currentBase + delta),
                    }));
                  }}
                  onResizeEnd={() => {
                    resizingRef.current = null;
                    onColumnWidthsChange?.(liveWidthsRef.current);
                  }}
                />
              ) : null}
            </th>
          );
        })}
        {rowEndWidth ? (
          <th
            scope="col"
            style={{ width: rowEndWidth }}
            className="fp-sticky fp-top-0 fp-z-[3] fp-bg-surface fp-px-4 fp-py-2 fp-text-right"
          >
            <span className="fp-sr-only">{rowEndCellLabel}</span>
          </th>
        ) : null}
      </tr>
    </thead>
  );
}
