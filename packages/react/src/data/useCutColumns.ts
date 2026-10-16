"use client";
import * as React from "react";
import type { DataTableColumn } from "./data-table-types";

const MOST_PX = 64;

/** Px a header or a fixed-shape value is cut by in the reader's real font, once fonts load; it only rises. */
export function useCutColumns<Row>(
  table: React.RefObject<HTMLTableElement | null>,
  columns: ReadonlyArray<DataTableColumn<Row>>,
  rows: unknown,
): Record<string, number> {
  const [raised, setRaised] = React.useState<Record<string, number>>({});
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new page of rows is the trigger.
  React.useEffect(() => {
    let live = true;
    void Promise.all([document.fonts?.ready, import("./cut-columns")]).then(([, measure]) => {
      const node = table.current;
      if (!live || !node) return;
      const found = measure.cutColumns(node, columns);
      if (Object.keys(found).length === 0) return;
      setRaised((current) => {
        const next = { ...current };
        for (const [field, px] of Object.entries(found)) {
          next[field] = Math.min(MOST_PX, (current[field] ?? 0) + px);
        }
        return next;
      });
    });
    return () => {
      live = false;
    };
  }, [table, columns, rows]);
  return raised;
}
