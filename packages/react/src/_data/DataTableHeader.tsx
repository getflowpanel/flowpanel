"use client";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type * as React from "react";
import { useLabels } from "../_provider/LabelsContext";
import { cn } from "../lib/cn";
import { resolveFieldLabel } from "../lib/humanize";
import { LABEL_TEXT } from "../lib/label-text";
import { Checkbox } from "../ui/checkbox";
import { ColumnPinMenu } from "./ColumnPinMenu";
import { ColumnResizer } from "./ColumnResizer";
import type { DataTableColumn, DataTableSort } from "./data-table-types";
import { ALIGN_CLASS, widthToCss } from "./format-cell";
import type { PinMeta } from "./useColumnLayout";

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
  const labels = useLabels();
  return (
    <thead className={LABEL_TEXT}>
      <tr className="fp-border-b fp-border-line">
        {selectionEnabled ? (
          <th scope="col" className="fp-w-10 fp-px-4 fp-py-2">
            <Checkbox
              checked={allOnPageSelected}
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
                "fp-group fp-px-4 fp-py-2.5 fp-font-normal fp-select-none",
                ALIGN_CLASS[c.align ?? "left"],
                wCss !== undefined && "fp-w-[var(--fp-col-w)]",
                meta.side === "left" &&
                  "fp-sticky fp-left-[var(--fp-col-pin-left)] fp-bg-surface fp-z-[2]",
                meta.side === "right" &&
                  "fp-sticky fp-right-[var(--fp-col-pin-right)] fp-bg-surface fp-z-[2]",
                meta.side === "none" && "fp-relative",
                c.className,
              )}
            >
              {c.sortable ? (
                <button
                  type="button"
                  onClick={() => onHeaderClick(c)}
                  className={cn(
                    "fp-inline-flex fp-items-center fp-gap-1 fp-rounded-sm fp-transition-colors hover:fp-text-ink focus-visible:fp-outline-none focus-visible:fp-ring-2 focus-visible:fp-ring-focus/60",
                    c.align === "right" && "fp-flex-row-reverse",
                    active && "fp-text-ink",
                  )}
                >
                  {resolveFieldLabel(c.label, c.field)}
                  {active ? (
                    sort?.dir === "asc" ? (
                      <ArrowUp aria-hidden className="fp-h-3 fp-w-3" />
                    ) : (
                      <ArrowDown aria-hidden className="fp-h-3 fp-w-3" />
                    )
                  ) : (
                    <ChevronsUpDown
                      aria-hidden
                      className="fp-h-3 fp-w-3 fp-opacity-0 fp-transition-opacity group-hover:fp-opacity-60"
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
          <th scope="col" className="fp-w-10 fp-px-4 fp-py-2 fp-text-right">
            <span className="fp-sr-only">{rowEndCellLabel}</span>
          </th>
        ) : null}
      </tr>
    </thead>
  );
}
