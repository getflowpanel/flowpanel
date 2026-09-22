import type {
  ColumnDef,
  ColumnFormat,
  DetailTab,
  FieldDef,
  RequestContext,
  ResolvedFormatting,
  ResourceConfig,
} from "@flowpanel/core";
import type * as React from "react";
import { formatFieldValue } from "../../runtime/format-field-value";
import { prerenderResourceCells } from "../../runtime/prerender-cells";
import { renderColumnFormat } from "../../runtime/render-column-format";

export interface DetailCell {
  label?: string;
  format?: ColumnFormat;
  node?: React.ReactNode;
}

/** Field → the list page's own label / render / format for that column. */
export function buildDetailCells<Row extends Record<string, unknown>>(
  resource: ResourceConfig,
  row: Row,
  reqCtx: RequestContext,
): Map<string, DetailCell> {
  const out = new Map<string, DetailCell>();
  const defs = resource.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>> | undefined;
  if (!defs || defs.length === 0) return out;
  const { columns, prerenderedCells } = prerenderResourceCells<Row>(defs, [row], reqCtx);
  columns.forEach((c, i) => {
    const cell: DetailCell = {};
    if (c.label !== undefined) cell.label = c.label;
    if (c.format !== undefined) cell.format = c.format;
    const node = prerenderedCells?.[0]?.[i];
    if (node !== undefined) cell.node = node;
    out.set(c.field as string, cell);
  });
  return out;
}

export function detailValue(
  value: unknown,
  cell: DetailCell | undefined,
  formatting: ResolvedFormatting,
): React.ReactNode {
  if (cell?.node !== undefined) return cell.node;
  if (cell?.format !== undefined) return renderColumnFormat(cell.format, value, formatting);
  return formatFieldValue(value);
}

export interface DetailField {
  name: string;
  label?: string;
}

/** Flatten a declared field list; `"*"` and an omitted list mean every readable key. */
export function selectFields<Row extends Record<string, unknown>>(
  row: Row,
  fields: DetailTab<Row>["fields"],
): DetailField[] {
  if (fields === undefined || fields === "*") {
    return Object.keys(row).map((k) => ({ name: k }));
  }
  return fields.map((f) => {
    if (typeof f === "string" || typeof f === "number" || typeof f === "symbol") {
      return { name: String(f) };
    }
    const def = f as FieldDef<Row>;
    return def.label !== undefined
      ? { name: String(def.name), label: def.label }
      : { name: String(def.name) };
  });
}
