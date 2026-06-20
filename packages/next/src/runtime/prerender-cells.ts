import type { ColumnDef, ColumnFormat, ColumnMeta, RequestContext } from "@flowpanel/core";
import type { ReactNode } from "react";

/** Wire-safe column metadata derived from a resource's `ColumnDef[]`. */
export interface PrerenderedColumn<Row> {
  field: keyof Row & string;
  label?: string;
  sortable?: boolean;
  width?: number | string;
  align?: "left" | "center" | "right";
  className?: string;
  hidden?: boolean;
  type?: ColumnMeta["type"];
  /** Mirrors `ColumnDef.editable`. When true, the cell renders as `<InlineEditCell>`. */
  editable?: boolean;
  /** Mirrors `ColumnDef.format`. Plain data, so it crosses to the client verbatim. */
  format?: ColumnFormat;
}

export interface PrerenderResult<Row> {
  /** Column metadata stripped of `render`. Indexed identically to `prerenderedCells[i]`. */
  columns: PrerenderedColumn<Row>[];
  /** Server-prerendered cell content, `[rowIndex][colIndex]` against `columns`. */
  prerenderedCells: (ReactNode | undefined)[][] | undefined;
}

export interface PrerenderOptions {
  /** Drop columns whose `hidden` flag is truthy. */
  dropHidden?: boolean;
  /** Default value for `sortable` when a `ColumnDef` doesn't set it. */
  defaultSortable?: boolean;
  /** Adapter introspection keyed by column name. */
  metaByField?: ReadonlyMap<string, ColumnMeta>;
}

export function prerenderResourceCells<Row>(
  columnDefs: ReadonlyArray<keyof Row | ColumnDef<Row>>,
  rows: ReadonlyArray<Row>,
  reqCtx: RequestContext,
  options: PrerenderOptions = {},
): PrerenderResult<Row> {
  const { dropHidden = false, defaultSortable, metaByField } = options;
  const columns: PrerenderedColumn<Row>[] = [];
  const renderFns: (((row: Row) => ReactNode) | null)[] = [];

  for (const c of columnDefs) {
    if (typeof c === "string" || typeof c === "number" || typeof c === "symbol") {
      const field = String(c) as keyof Row & string;
      const col: PrerenderedColumn<Row> = { field };
      if (defaultSortable !== undefined) col.sortable = defaultSortable;
      const meta = metaByField?.get(field);
      if (meta) col.type = meta.type;
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
    if (def.editable === true) out.editable = true;
    if (def.format !== undefined) out.format = def.format;
    if (def.reference) out.type = "reference";
    else {
      const meta = metaByField?.get(field);
      if (meta) out.type = meta.type;
    }
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
