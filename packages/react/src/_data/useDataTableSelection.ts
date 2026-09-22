"use client";
import * as React from "react";

export interface DataTableSelection<Row> {
  selectionEnabled: boolean;
  /** The row's identifier, or `null` when the projection did not include one. */
  identityOf: (row: Row) => string | null;
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
  // A projection may legitimately omit the key column. The literal string
  // "undefined" is a valid identifier; an absent or non-scalar value is not.
  const identityOf = React.useCallback(
    (row: Row): string | null => {
      if (getRowKey) return getRowKey(row) || null;
      const raw = row[rowKey];
      if (typeof raw === "string") return raw || null;
      if (typeof raw === "number" || typeof raw === "bigint") return String(raw);
      return null;
    },
    [getRowKey, rowKey],
  );
  const selectionSet = React.useMemo(() => new Set(selection ?? []), [selection]);
  const identifiable = React.useMemo(
    () => rows.filter((row) => identityOf(row) !== null),
    [rows, identityOf],
  );
  const allOnPageSelected =
    identifiable.length > 0 &&
    identifiable.every((row) => selectionSet.has(identityOf(row) as string));

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
      const remaining = Array.from(selectionSet).filter(
        (id) => !identifiable.some((row) => identityOf(row) === id),
      );
      onSelectionChange(remaining);
    } else {
      const union = new Set(selectionSet);
      for (const row of identifiable) union.add(identityOf(row) as string);
      onSelectionChange(Array.from(union));
    }
  };

  return {
    selectionEnabled,
    identityOf,
    selectionSet,
    allOnPageSelected,
    toggleRow,
    toggleAll,
  };
}
