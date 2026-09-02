"use client";
import * as React from "react";
import type { DataTableColumn } from "./data-table-types";

export interface PinMeta {
  side: "left" | "right" | "none";
  offset: number;
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

export function useColumnLayout<Row>(params: {
  columns: DataTableColumn<Row>[];
  columnVisibility?: Record<string, boolean>;
  columnWidths?: Record<string, number>;
  pinnedColumns?: { left?: string[]; right?: string[] };
}): ColumnLayout<Row> {
  const { columns, columnVisibility, columnWidths, pinnedColumns } = params;

  const [liveWidths, setLiveWidths] = React.useState<Record<string, number>>(columnWidths ?? {});
  React.useEffect(() => {
    setLiveWidths((current) =>
      shallowEqualWidths(current, columnWidths ?? {}) ? current : { ...(columnWidths ?? {}) },
    );
  }, [columnWidths]);
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
    let leftOffset = 0;
    for (const c of orderedVisible) {
      if (leftPins.includes(c.field)) {
        map.set(c.field, { side: "left", offset: leftOffset });
        const w = liveWidths[c.field] ?? (typeof c.width === "number" ? c.width : 120);
        leftOffset += w;
      }
    }
    let rightOffset = 0;
    for (const c of [...orderedVisible].reverse()) {
      if (rightPins.includes(c.field)) {
        map.set(c.field, { side: "right", offset: rightOffset });
        const w = liveWidths[c.field] ?? (typeof c.width === "number" ? c.width : 120);
        rightOffset += w;
      }
    }
    for (const c of orderedVisible) {
      if (!map.has(c.field)) map.set(c.field, { side: "none", offset: 0 });
    }
    return map;
  }, [orderedVisible, leftPins, rightPins, liveWidths]);

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
