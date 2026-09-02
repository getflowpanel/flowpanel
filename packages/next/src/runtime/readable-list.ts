import type { ColumnDef, RequestContext, ResourceConfig } from "@flowpanel/core";
import { declaredFieldSet } from "./parse-list-params";
import { declaredRowFields } from "./project-row";
import {
  filterColumnsByReadableFields,
  filterReadableDeclarations,
  resolveReadableFieldSet,
  sanitizeReadableListSearchParams,
} from "./readable-fields";

type Row = Record<string, unknown>;

export interface ReadableListSurface {
  fields: ReadonlySet<string>;
  rowFields: string[];
  columns: ReadonlyArray<keyof Row | ColumnDef<Row>>;
  filters: unknown[];
  searchFields: string[];
  defaultSort?: { field: string; dir: "asc" | "desc" };
  searchParams: URLSearchParams;
}

/** Resolve every caller-visible list control before URL parsing or adapter work. */
export async function resolveReadableListSurface(
  resource: ResourceConfig,
  reqCtx: RequestContext,
  searchParams: URLSearchParams,
): Promise<ReadableListSurface> {
  const defaultSortRaw = resource.options.defaultSort;
  const declared = declaredFieldSet({
    columns: resource.options.columns as unknown[],
    filters: resource.options.filters as unknown[] | undefined,
    search: resource.options.search as unknown[] | undefined,
    ...(defaultSortRaw ? { defaultSort: { field: String(defaultSortRaw.field) } } : {}),
  });
  // One resolution for the whole page: a field policy may be async, and the
  // list controls and the projected rows must never disagree about a field.
  const rowDeclared = declaredRowFields(resource);
  const readable = await resolveReadableFieldSet(
    [...declared, ...rowDeclared],
    resource.options.fieldAccess,
    reqCtx,
  );
  const fields = new Set([...declared].filter((field) => readable.has(field)));
  const searchFields = (resource.options.search ?? [])
    .map(String)
    .filter((field) => fields.has(field));
  const defaultSort =
    defaultSortRaw && fields.has(String(defaultSortRaw.field))
      ? { field: String(defaultSortRaw.field), dir: defaultSortRaw.dir }
      : undefined;

  return {
    fields,
    rowFields: [...rowDeclared].filter((field) => readable.has(field)),
    columns: filterColumnsByReadableFields(
      resource.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>>,
      fields,
    ),
    filters: filterReadableDeclarations(resource.options.filters, fields),
    searchFields,
    ...(defaultSort ? { defaultSort } : {}),
    searchParams: sanitizeReadableListSearchParams(searchParams, fields, searchFields.length > 0),
  };
}
