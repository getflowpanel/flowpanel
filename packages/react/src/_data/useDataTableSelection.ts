"use client";
import * as React from "react";

export interface DataTableSelection<Row> {
  selectionEnabled: boolean;
  keyOf: (row: Row) => string;
  selectionSet: Set<string>;
  allOnPageSelected: boolean;
  toggleRow: (id: string) => void;
  toggleAll: () => void;
}

export function useDataTableSelection<Row extends Record<string, unknown>>(params: {
  rows: Row[];
  rowKey: keyof Row & string;
  selection?: string[];
  onSelectionChange?: (ids: string[]) => void;
  getRowKey?: (row: Row) => string;
}): DataTableSelection<Row> {
  const { rows, rowKey, selection, onSelectionChange, getRowKey } = params;

  const selectionEnabled = onSelectionChange !== undefined;
  const keyOf = React.useCallback(
    (row: Row) => (getRowKey ? getRowKey(row) : String(row[rowKey])),
    [getRowKey, rowKey],
  );
  const selectionSet = React.useMemo(() => new Set(selection ?? []), [selection]);
  const allOnPageSelected = rows.length > 0 && rows.every((r) => selectionSet.has(keyOf(r)));

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectionSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(Array.from(next));
  };
  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allOnPageSelected) {
      const remaining = Array.from(selectionSet).filter((id) => !rows.some((r) => keyOf(r) === id));
      onSelectionChange(remaining);
    } else {
      const union = new Set(selectionSet);
      for (const r of rows) union.add(keyOf(r));
      onSelectionChange(Array.from(union));
    }
  };

  return { selectionEnabled, keyOf, selectionSet, allOnPageSelected, toggleRow, toggleAll };
}
