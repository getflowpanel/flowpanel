"use client";
import * as React from "react";

export interface DataTableKeyboard {
  cursor: number;
  setCursor: React.Dispatch<React.SetStateAction<number>>;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTableSectionElement>) => void;
}

export function useDataTableKeyboard<Row>(params: {
  rows: Row[];
  onRowClick?: (row: Row) => void;
  onEditRow?: (row: Row) => void;
  onDeleteRow?: (row: Row) => void;
  onFocusSearch?: () => void;
  onShowShortcuts?: () => void;
}): DataTableKeyboard {
  const { rows, onRowClick, onEditRow, onDeleteRow, onFocusSearch, onShowShortcuts } = params;
  const [cursor, setCursor] = React.useState<number>(-1);

  // Reset cursor when the row set genuinely changes (new page, filter, etc),
  // but NOT when realtime `router.refresh()` rebuilds an equivalent `rows`
  // array (new identity, same rows). Key on a stable signature — length plus
  // the first and last row's identity — instead of the array reference, which
  // changes on every render.
  const rowsSignature = `${rows.length}:${rowIdentity(rows[0])}:${rowIdentity(rows[rows.length - 1])}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: the stable signature is the intended trigger, not `rows` identity.
  React.useEffect(() => {
    setCursor(-1);
  }, [rowsSignature]);

  // Tracks the last typed key so we can recognize multi-key sequences
  // like `g g` (jump to top). React's KeyDown handler doesn't see
  // sequences directly, so we keep a one-key memory with a short TTL.
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
      // `g g` jumps to the first row; treat lone `g` as the first half of
      // the sequence and remember it for ~500ms.
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
      if (focusedRow !== undefined) onRowClick?.(focusedRow);
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

  return { cursor, setCursor, handleKeyDown };
}

/**
 * Stable identity string for a row, used to detect a genuine dataset change
 * (page/filter) versus a realtime refresh that rebuilds the array with the
 * same rows. Prefers a primary-key field (`id`); falls back to the row's own
 * primitive values when no such field exists.
 */
function rowIdentity(row: unknown): string {
  if (row === null || row === undefined) return "";
  if (typeof row === "object") {
    const r = row as Record<string, unknown>;
    for (const key of ["id", "_id", "uuid", "slug"]) {
      if (r[key] !== undefined && r[key] !== null) return `${key}=${String(r[key])}`;
    }
    // No conventional key — snapshot primitive own-values so the signature is
    // at least stable across re-renders of the same data.
    return Object.entries(r)
      .filter(([, v]) => v === null || typeof v !== "object")
      .map(([k, v]) => `${k}=${String(v)}`)
      .join("|");
  }
  return String(row);
}
