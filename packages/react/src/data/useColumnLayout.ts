"use client";
import * as React from "react";
import { columnWidth } from "./column-sizing";
import type { DataTableColumn } from "./data-table-types";

export interface PinMeta {
  side: "left" | "right" | "none";
  offset: number;
  /** Held in place by the table itself, not by the reader's pin. */
  auto?: boolean;
}

export interface ColumnLayout<Row> {
  orderedVisible: DataTableColumn<Row>[];
  colIndexByField: Map<string, number>;
  leftPins: string[];
  rightPins: string[];
  pinMeta: Map<string, PinMeta>;
  effectiveWidths: Record<string, number>;
  setLiveWidths: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  liveWidthsRef: React.MutableRefObject<Record<string, number>>;
  resizingRef: React.MutableRefObject<{ field: string; base: number } | null>;
}

/** Shallow value-equality for width maps (same keys, same numeric widths). */
function shallowEqualWidths(a: Record<string, number>, b: Record<string, number>): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

const REM_PX = 16;

/** A pinned column's width in pixels, for the offset of the pinned column after it. */
function pinnedWidthPx<Row>(column: DataTableColumn<Row>, live: number | undefined): number {
  const css = columnWidth(column, live) ?? "12rem";
  const value = Number.parseFloat(css);
  return css.endsWith("rem") ? value * REM_PX : Number.isNaN(value) ? 12 * REM_PX : value;
}

export function useColumnLayout<Row>(params: {
  columns: DataTableColumn<Row>[];
  columnVisibility?: Record<string, boolean>;
  columnWidths?: Record<string, number>;
  pinnedColumns?: { left?: string[]; right?: string[] };
  /** Width of the fixed column before the first data column, such as the checkboxes. */
  leadingPx?: number;
}): ColumnLayout<Row> {
  const { columns, columnVisibility, columnWidths, pinnedColumns, leadingPx = 0 } = params;

  const [liveWidths, setLiveWidths] = React.useState<Record<string, number>>(columnWidths ?? {});
  const [syncedWidths, setSyncedWidths] = React.useState(columnWidths);
  if (syncedWidths !== columnWidths) {
    setSyncedWidths(columnWidths);
    if (!shallowEqualWidths(liveWidths, columnWidths ?? {}))
      setLiveWidths({ ...(columnWidths ?? {}) });
  }
  const resizingRef = React.useRef<{ field: string; base: number } | null>(null);
  const liveWidthsRef = React.useRef(liveWidths);
  React.useEffect(() => {
    liveWidthsRef.current = liveWidths;
  }, [liveWidths]);

  const visible = React.useMemo(
    () => columns.filter((c) => !c.hidden && (columnVisibility?.[c.field] ?? true)),
    [columns, columnVisibility],
  );

  const colIndexByField = React.useMemo(() => {
    const m = new Map<string, number>();
    columns.forEach((c, i) => {
      m.set(c.field, i);
    });
    return m;
  }, [columns]);

  const { leftPins, rightPins } = React.useMemo(
    () => ({
      leftPins: pinnedColumns?.left ?? [],
      rightPins: pinnedColumns?.right ?? [],
    }),
    [pinnedColumns],
  );

  const orderedVisible = React.useMemo(() => {
    const leftSet = new Set(leftPins);
    const rightSet = new Set(rightPins);
    const left: typeof visible = [];
    const middle: typeof visible = [];
    const right: typeof visible = [];
    for (const c of visible) {
      if (leftSet.has(c.field)) left.push(c);
      else if (rightSet.has(c.field)) right.push(c);
      else middle.push(c);
    }
    left.sort((a, b) => leftPins.indexOf(a.field) - leftPins.indexOf(b.field));
    right.sort((a, b) => rightPins.indexOf(a.field) - rightPins.indexOf(b.field));
    return [...left, ...middle, ...right];
  }, [visible, leftPins, rightPins]);

  const pinMeta = React.useMemo(() => {
    const map = new Map<string, PinMeta>();
    let leftOffset = leadingPx;
    // With no pins of its own, the first column stays in view while the table scrolls sideways.
    const first = leftPins.length === 0 ? orderedVisible[0] : undefined;
    if (first) map.set(first.field, { side: "left", offset: leftOffset, auto: true });
    for (const c of orderedVisible) {
      if (leftPins.includes(c.field)) {
        map.set(c.field, { side: "left", offset: leftOffset });
        leftOffset += pinnedWidthPx(c, liveWidths[c.field]);
      }
    }
    let rightOffset = 0;
    for (const c of [...orderedVisible].reverse()) {
      if (rightPins.includes(c.field)) {
        map.set(c.field, { side: "right", offset: rightOffset });
        rightOffset += pinnedWidthPx(c, liveWidths[c.field]);
      }
    }
    for (const c of orderedVisible) {
      if (!map.has(c.field)) map.set(c.field, { side: "none", offset: 0 });
    }
    return map;
  }, [orderedVisible, leftPins, rightPins, liveWidths, leadingPx]);

  return {
    orderedVisible,
    colIndexByField,
    leftPins,
    rightPins,
    pinMeta,
    effectiveWidths: liveWidths,
    setLiveWidths,
    liveWidthsRef,
    resizingRef,
  };
}
