import type { ColumnDef, RequestContext } from "@flowpanel/core";
import type { ReactNode } from "react";

/**
 * Wire-safe column metadata derived from a resource's `ColumnDef[]`. Carries
 * every prop a `DataTable` / `TableWidget` consumer needs, but never the
 * `render` function — function refs can't cross the RSC → Client boundary, so
 * any `ColumnDef.render` gets executed server-side into `prerenderedCells`.
 */
export interface PrerenderedColumn<Row> {
  field: keyof Row & string;
  label?: string;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "center" | "right";
  className?: string;
  hidden?: boolean;
}

export interface PrerenderResult<Row> {
  /** Column metadata stripped of `render`. Indexed identically to `prerenderedCells[i]`. */
  columns: PrerenderedColumn<Row>[];
  /**
   * Server-prerendered cell content, `[rowIndex][colIndex]` against `columns`.
   * `undefined` cells let `DataTable` fall back to `c.render` → `formatCell`.
   * The whole array is `undefined` when no column declares a `render` fn.
   */
  prerenderedCells: (ReactNode | undefined)[][] | undefined;
}

export interface PrerenderOptions {
  /**
   * Drop columns whose `hidden` flag is truthy. The dedicated list page keeps
   * them (so DataTable can flip them on at runtime via `columnVisibility`),
   * but the dashboard table widget wants them gone for good.
   */
  dropHidden?: boolean;
  /**
   * Default value for `sortable` when a `ColumnDef` doesn't set it. The
   * resource list defaults to `true`; the widget table wants `undefined`
   * (no sort UI).
   */
  defaultSortable?: boolean;
}

/**
 * Walk a resource's `columns` definition once, producing both the wire-safe
 * column metadata and the pre-invoked render output for every row × column
 * pair. Shared by `ResourceListPage` and the dashboard `table` widget; before
 * the extraction the two had drifted implementations of the same loop.
 */
export function prerenderResourceCells<Row>(
  columnDefs: ReadonlyArray<keyof Row | ColumnDef<Row>>,
  rows: ReadonlyArray<Row>,
  reqCtx: RequestContext,
  options: PrerenderOptions = {},
): PrerenderResult<Row> {
  const { dropHidden = false, defaultSortable } = options;
  const columns: PrerenderedColumn<Row>[] = [];
  const renderFns: (((row: Row) => ReactNode) | null)[] = [];

  for (const c of columnDefs) {
    if (typeof c === "string" || typeof c === "number" || typeof c === "symbol") {
      const field = String(c) as keyof Row & string;
      const col: PrerenderedColumn<Row> = { field };
      if (defaultSortable !== undefined) col.sortable = defaultSortable;
      columns.push(col);
      renderFns.push(null);
      continue;
    }
    const def = c as ColumnDef<Row>;
    if (dropHidden && def.hidden) continue;
    const field = String(def.field ?? "") as keyof Row & string;
    if (!field) continue;
    const out: PrerenderedColumn<Row> = { field };
    if (def.label) out.label = def.label;
    const sortable = def.sortable ?? defaultSortable;
    if (sortable !== undefined) out.sortable = sortable;
    if (def.width !== undefined) out.width = def.width;
    if (def.align) out.align = def.align;
    if (def.className) out.className = def.className;
    if (def.hidden !== undefined) out.hidden = def.hidden;
    columns.push(out);
    if (def.render) {
      const fn = def.render;
      renderFns.push((row: Row) => fn(row, reqCtx));
    } else {
      renderFns.push(null);
    }
  }

  const hasAnyRenderer = renderFns.some((fn) => fn !== null);
  const prerenderedCells: (ReactNode | undefined)[][] | undefined = hasAnyRenderer
    ? rows.map((row) => renderFns.map((fn) => (fn ? fn(row) : undefined)))
    : undefined;

  return { columns, prerenderedCells };
}
