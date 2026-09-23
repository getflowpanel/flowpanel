"use client";
import { useRouter } from "next/navigation";
import * as React from "react";

/**
 * Navigate to a row's own href. Widgets hand rows to `DataTable` as data, so the
 * one thing a row click needs is a push; this keeps that push in one place for
 * every widget and table that gains row navigation.
 */
export function useRowNavigation(): (href: string) => void {
  const router = useRouter();
  return React.useCallback(
    (href: string) => {
      router.push(href);
    },
    [router],
  );
}

/**
 * A row click that pushes the row's own href from `rowHrefs`, indexed like `rows`.
 * A `null` entry leaves that row inert; no `rowHrefs` returns `undefined`.
 */
export function useRowHrefClick<Row>(
  rows: readonly Row[],
  rowHrefs: readonly (string | null)[] | undefined,
): ((row: Row) => void) | undefined {
  const navigate = useRowNavigation();
  return React.useMemo(() => {
    if (!rowHrefs) return undefined;
    const hrefByRow = new Map(rows.map((row, index) => [row, rowHrefs[index] ?? null]));
    return (row: Row) => {
      const href = hrefByRow.get(row);
      if (href) navigate(href);
    };
  }, [rows, rowHrefs, navigate]);
}
