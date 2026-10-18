import type {
  ColumnDef,
  ColumnFormat,
  DetailTab,
  FieldDef,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedFormatting,
  ResourceConfig,
} from "@flowpanel/core";
import { ReferenceCell } from "@flowpanel/react";
import type * as React from "react";
import { fieldLabels } from "../../runtime/field-labels";
import { formatFieldValue } from "../../runtime/format-field-value";
import { buildHref } from "../../runtime/href";
import { renderMarkdown } from "../../runtime/markdown";
import { prerenderResourceCells } from "../../runtime/prerender-cells";
import { renderColumnFormat } from "../../runtime/render-column-format";
import { resolveReferences } from "../../runtime/resolve-references";

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
  named: Readonly<Record<string, string>> = {},
): Map<string, DetailCell> {
  const out = new Map<string, DetailCell>();
  const defs = resource.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>> | undefined;
  if (!defs || defs.length === 0) return out;
  const { columns, prerenderedCells } = prerenderResourceCells<Row>(defs, [row], reqCtx, {
    labelOf: fieldLabels(resource, [], named),
  });
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

/** A shown `reference` column reads as its record's label with a link, as the list shows it. */
export async function withReferenceCells<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  resource: ResourceConfig,
  row: Row,
  shown: ReadonlySet<string>,
  cells: Map<string, DetailCell>,
): Promise<Map<string, DetailCell>> {
  const defs = (resource.options.columns ?? []) as ReadonlyArray<keyof Row | ColumnDef<Row>>;
  const references = defs.filter(
    (def): def is ColumnDef<Row> =>
      typeof def === "object" && def.reference !== undefined && shown.has(String(def.field)),
  );
  if (references.length === 0) return cells;
  const labelsByField = await resolveReferences<Row>(config, reqCtx, references, [row]);
  for (const def of references) {
    const field = String(def.field);
    const raw = row[field];
    const label =
      raw === null || raw === undefined ? undefined : labelsByField.get(field)?.get(String(raw));
    if (label === undefined || !def.reference) continue;
    const href = buildHref(config, def.reference.resource, String(raw));
    cells.set(field, {
      ...cells.get(field),
      node: <ReferenceCell label={String(label)} href={href} />,
    });
  }
  return cells;
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
  render?: (row: never, ctx: RequestContext) => React.ReactNode | Promise<React.ReactNode>;
}

/**
 * Each field's own `render`, run concurrently for a field the projected row carries; one that
 * throws is logged and left out, so the field shows its formatted value.
 */
export async function renderDetailFields(
  row: Record<string, unknown>,
  fields: DetailField[],
  reqCtx: RequestContext,
  markdown: ReadonlySet<string> = new Set(),
): Promise<Map<string, React.ReactNode>> {
  const written = fields
    .filter((field) => !field.render && markdown.has(field.name) && Object.hasOwn(row, field.name))
    .map((field) => [field.name, renderMarkdown(row[field.name])] as const);
  const rendered = await Promise.all(
    fields
      .filter((field) => field.render && Object.hasOwn(row, field.name))
      .map(async (field): Promise<readonly [string, React.ReactNode] | null> => {
        try {
          return [field.name, await field.render?.(row as never, reqCtx)];
        } catch (error) {
          console.error(`[flowpanel] detail render failed for "${field.name}"`, error);
          return null;
        }
      }),
  );
  return new Map([...written, ...rendered.filter((entry) => entry !== null)]);
}

/** Flatten a declared field list to the fields the row carries; `"*"` or none means all of them. */
export function selectFields<Row extends Record<string, unknown>>(
  row: Row,
  fields: DetailTab<Row>["fields"],
): DetailField[] {
  if (fields === undefined || fields === "*") {
    return Object.keys(row).map((k) => ({ name: k }));
  }
  return fields
    .map((f) => {
      if (typeof f === "string" || typeof f === "number" || typeof f === "symbol") {
        return { name: String(f) };
      }
      const def = f as FieldDef<Row>;
      return {
        name: String(def.name),
        ...(def.label !== undefined ? { label: def.label } : {}),
        ...(def.render ? { render: def.render as DetailField["render"] } : {}),
      } as DetailField;
    })
    .filter((field) => Object.hasOwn(row, field.name));
}
