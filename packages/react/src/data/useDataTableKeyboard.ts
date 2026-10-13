"use client";
import * as React from "react";

export interface DataTableKeyboard {
  cursor: number;
  setCursor: React.Dispatch<React.SetStateAction<number>>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTableSectionElement>) => void;
  /** Enter opens some row on this page. */
  opensRows: boolean;
}

/** Every key obeys the identity rule the pointer does: a row without an identifier is not actionable. */
function identified<Row>(
  handler: ((row: Row) => void) | undefined,
  identityOf: (row: Row) => string | null,
): ((row: Row) => void) | undefined {
  return handler
    ? (row: Row) => {
        if (identityOf(row) !== null) handler(row);
      }
    : undefined;
}

export function useDataTableKeyboard<Row>(params: {
  rows: Row[];
  identityOf: (row: Row) => string | null;
  onRowClick?: (row: Row) => void;
  onEditRow?: (row: Row) => void;
  onDeleteRow?: (row: Row) => void;
  onFocusSearch?: () => void;
  onShowShortcuts?: () => void;
}): DataTableKeyboard {
  const { rows, identityOf, onFocusSearch, onShowShortcuts } = params;
  const onRowClick = identified(params.onRowClick, identityOf);
  const onEditRow = identified(params.onEditRow, identityOf);
  const onDeleteRow = identified(params.onDeleteRow, identityOf);
  const [cursor, setCursor] = React.useState<number>(-1);

  // New rows drop the cursor in the same render, so the old row's index never lights up a new row.
  const rowsSignature = `${rows.length}:${rowIdentity(rows[0])}:${rowIdentity(rows[rows.length - 1])}`;
  const [cursorRows, setCursorRows] = React.useState(rowsSignature);
  if (cursorRows !== rowsSignature) {
    setCursorRows(rowsSignature);
    setCursor(-1);
  }

  const lastKeyRef = React.useRef<{ key: string; at: number } | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
    if (rows.length === 0) return;
    const focusedRow = cursor >= 0 ? rows[cursor] : undefined;

    if (e.key === "j" || e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(rows.length - 1, c < 0 ? 0 : c + 1));
    } else if (e.key === "k" || e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "g" && !e.shiftKey) {
      const prev = lastKeyRef.current;
      if (prev?.key === "g" && Date.now() - prev.at < 500) {
        e.preventDefault();
        setCursor(0);
        lastKeyRef.current = null;
      } else {
        lastKeyRef.current = { key: "g", at: Date.now() };
      }
    } else if (e.key === "G" || (e.key === "g" && e.shiftKey)) {
      e.preventDefault();
      setCursor(rows.length - 1);
    } else if (e.key === "Enter") {
      if (focusedRow !== undefined) {
        // The row opens now, so the drawer's first focusable element must not also receive this key.
        e.preventDefault();
        onRowClick?.(focusedRow);
      }
    } else if (e.key === "e" && focusedRow !== undefined && onEditRow) {
      e.preventDefault();
      onEditRow(focusedRow);
    } else if (e.key === "d" && focusedRow !== undefined && onDeleteRow) {
      e.preventDefault();
      onDeleteRow(focusedRow);
    } else if (e.key === "/" && onFocusSearch) {
      e.preventDefault();
      onFocusSearch();
    } else if (e.key === "?" && onShowShortcuts) {
      e.preventDefault();
      onShowShortcuts();
    } else if (e.key === "Escape") {
      setCursor(-1);
    }
  };

  const opensRows = onRowClick !== undefined && rows.some((row) => identityOf(row) !== null);
  return { cursor, setCursor, handleKeyDown, opensRows };
}

function rowIdentity(row: unknown): string {
  if (row === null || row === undefined) return "";
  if (typeof row === "object") {
    const r = row as Record<string, unknown>;
    for (const key of ["id", "_id", "uuid", "slug"]) {
      if (r[key] !== undefined && r[key] !== null) return `${key}=${String(r[key])}`;
    }
    return Object.entries(r)
      .filter(([, v]) => v === null || typeof v !== "object")
      .map(([k, v]) => `${k}=${String(v)}`)
      .join("|");
  }
  return String(row);
}
