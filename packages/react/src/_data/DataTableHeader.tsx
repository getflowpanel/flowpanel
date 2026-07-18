"use client";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type * as React from "react";
import { cn } from "../lib/cn.js";
import { resolveFieldLabel } from "../lib/humanize.js";
import { Checkbox } from "../ui/checkbox.js";
import { ColumnPinMenu } from "./ColumnPinMenu.js";
import { ColumnResizer } from "./ColumnResizer.js";
import type { DataTableColumn, DataTableSort } from "./data-table-types.js";
import { ALIGN_CLASS, widthToCss } from "./format-cell.js";
import type { PinMeta } from "./useColumnLayout.js";

export interface DataTableHeaderProps<Row> {
  orderedVisible: DataTableColumn<Row>[];
  sort?: DataTableSort<Row> | null;
  pinMeta: Map<string, PinMeta>;
  effectiveWidths: Record<string, number>;
  leftPins: string[];
  rightPins: string[];
  selectionEnabled: boolean;
  allOnPageSelected: boolean;
  onToggleAll: () => void;
  onHeaderClick: (c: DataTableColumn<Row>) => void;
  onColumnWidthsChange?: (widths: Record<string, number>) => void;
  onPinnedColumnsChange?: (pinned: { left?: string[]; right?: string[] }) => void;
  resizingRef: React.MutableRefObject<{ field: string; base: number } | null>;
  liveWidthsRef: React.MutableRefObject<Record<string, number>>;
  setLiveWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  rowEndCell?: unknown;
  rowEndCellLabel: string;
}

export function DataTableHeader<Row>({
  orderedVisible,
  sort,
  pinMeta,
  effectiveWidths,
  leftPins,
  rightPins,
  selectionEnabled,
  allOnPageSelected,
  onToggleAll,
  onHeaderClick,
  onColumnWidthsChange,
  onPinnedColumnsChange,
  resizingRef,
  liveWidthsRef,
  setLiveWidths,
  rowEndCell,
  rowEndCellLabel,
}: DataTableHeaderProps<Row>) {
  return (
    <thead className="text-fp-text-3 text-[11px] uppercase tracking-wider">
      <tr className="border-b border-fp-border-1">
        {selectionEnabled ? (
          <th scope="col" className="w-10 px-4 py-2">
            <Checkbox
              checked={allOnPageSelected}
              aria-label={
                allOnPageSelected
                  ? "Deselect all rows on this page"
                  : "Select all rows on this page"
              }
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
          const width = effectiveWidths[c.field] ?? c.width;
          const wCss = widthToCss(width);
          const meta = pinMeta.get(c.field) ?? { side: "none" as const, offset: 0 };
          const cssVars: Record<string, string> = {};
          if (wCss !== undefined) cssVars["--fp-col-w"] = wCss;
          if (meta.side === "left") cssVars["--fp-col-pin-left"] = `${meta.offset}px`;
          else if (meta.side === "right") cssVars["--fp-col-pin-right"] = `${meta.offset}px`;
          const currentPin: "left" | "right" | null =
            meta.side === "left" ? "left" : meta.side === "right" ? "right" : null;
          return (
            <th
              key={c.field}
              scope="col"
              aria-sort={c.sortable ? ariaSort : undefined}
              {...(Object.keys(cssVars).length > 0
                ? { style: cssVars as React.CSSProperties }
                : {})}
              className={cn(
                "group px-4 py-2.5 font-medium select-none",
                ALIGN_CLASS[c.align ?? "left"],
                wCss !== undefined && "w-[var(--fp-col-w)]",
                meta.side === "left" && "sticky left-[var(--fp-col-pin-left)] bg-fp-bg-1 z-[2]",
                meta.side === "right" && "sticky right-[var(--fp-col-pin-right)] bg-fp-bg-1 z-[2]",
                meta.side === "none" && "relative",
                c.className,
              )}
            >
              {c.sortable ? (
                <button
                  type="button"
                  onClick={() => onHeaderClick(c)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-fp-sm uppercase tracking-wider transition-colors hover:text-fp-text-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fp-focus/40",
                    active && "text-fp-text-1",
                  )}
                >
                  {resolveFieldLabel(c.label, c.field)}
                  {active ? (
                    sort?.dir === "asc" ? (
                      <ArrowUp aria-hidden className="h-3 w-3 text-fp-accent" />
                    ) : (
                      <ArrowDown aria-hidden className="h-3 w-3 text-fp-accent" />
                    )
                  ) : (
                    <ChevronsUpDown
                      aria-hidden
                      className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-60"
                    />
                  )}
                </button>
              ) : (
                resolveFieldLabel(c.label, c.field)
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
                          (typeof c.width === "number" ? c.width : 120));
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
        {rowEndCell ? (
          <th scope="col" className="w-10 px-4 py-2 text-right">
            <span className="sr-only">{rowEndCellLabel}</span>
          </th>
        ) : null}
      </tr>
    </thead>
  );
}
