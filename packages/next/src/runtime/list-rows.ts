import type {
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  accessAllows,
  assertResourceScope,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { declaredRowFields, projectRowFields, selectKnownFields } from "./project-row";
import { requestQueryContext } from "./query-context";
import { resolveReadableFieldSet } from "./readable-fields";
import { requireAccessIfSet } from "./require-access";
import { scopeBinding } from "./scope-binding";

type Row = Record<string, unknown>;

export interface ListRowsQuery {
  /** Narrowing the caller asked for; a field it cannot read is dropped. */
  filters?: Record<string, unknown>;
  /** Narrowing a relationship requires; a field the caller cannot read, or a missing value, empties the page. */
  constraints?: Record<string, unknown>;
  search?: string;
  /** Given and none readable, the page is empty; omitted, the resource's `search` applies leniently. */
  searchFields?: readonly string[];
  /** `undefined` takes the resource's `defaultSort`; `null` leaves the rows unsorted. */
  sort?: { field: string; dir: "asc" | "desc" } | null;
  page?: number;
  pageSize?: number;
  /** Fields each row carries. @defaultValue the resource's declared row fields */
  fields?: Iterable<string>;
  /** Loaded for the caller's own use, never in `rows`: the soft-delete column, say. */
  operationalFields?: Iterable<string>;
  includeDeleted?: boolean;
  /** Order ties, and an unsorted query, by the primary key, so consecutive pages never overlap. */
  stableOrder?: boolean;
  /** Only the total; no column is selected. */
  countOnly?: boolean;
  /** Fields the read policy already admitted for this request, so a page resolves it once. */
  readable?: ReadonlySet<string>;
  dateRange?: { from: Date; to: Date };
  searchParams?: URLSearchParams;
  signal?: AbortSignal;
}

export interface ListRowsPage {
  rows: Row[];
  /** `operationalFields` of each row, by index. */
  operational: Row[];
  total: number;
  page: number;
  pageSize: number;
  /** The fields each row may carry, as the caller's read policy resolved them. */
  fields: string[];
}

/** May this caller see a soft-deleted row in a list: they could restore it. */
export function mayListDeleted(resource: ResourceConfig, reqCtx: RequestContext): Promise<boolean> {
  return accessAllows(resolveOperationAccess(resource.options.access, "update"), reqCtx);
}

/** The key columns introspection actually reports; none when it only falls back to `id`. */
function keyColumns(config: ResolvedAdminConfig, resource: ResourceConfig): readonly string[] {
  const { keyColumns: composite, primaryKey, columns } = config.adapter.introspect(resource.ref);
  if (composite && composite.length > 0) return composite;
  return columns.some((column) => column.name === primaryKey) ? [primaryKey] : [];
}

function emptyPage(page: number, pageSize: number, fields: string[]): ListRowsPage {
  return { rows: [], operational: [], total: 0, page, pageSize, fields };
}

/** The caller may list `resource`: its tenant scope is declared and its `read` rule admits them. */
export async function requireListAccess(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
): Promise<void> {
  assertResourceScope({ hasGlobal: !!config.scope, resourceScope: resource.options.scope });
  await requireAccessIfSet(resolveOperationAccess(resource.options.access, "read"), reqCtx);
}

/** The one way rows are listed; throws `FlowpanelAccessError` when the caller may not read them. */
export async function listRows(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
  query: ListRowsQuery = {},
): Promise<ListRowsPage> {
  await requireListAccess(config, resource, reqCtx);
  return listReadableRows(config, resource, reqCtx, query);
}

/** `listRows` once `requireListAccess` has passed. */
export async function listReadableRows(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
  query: ListRowsQuery = {},
): Promise<ListRowsPage> {
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;
  const output = [...new Set(query.fields ?? declaredRowFields(resource))];
  const operationalFields = [...new Set(query.operationalFields ?? [])];
  const filters = query.filters ?? {};
  const constraints = query.constraints ?? {};
  const strictSearch = query.searchFields !== undefined;
  const searchFields = (query.searchFields ?? resource.options.search ?? []).map(String);
  const defaultSort = resource.options.defaultSort;
  const sort =
    query.sort === undefined
      ? defaultSort
        ? { field: String(defaultSort.field), dir: defaultSort.dir }
        : null
      : query.sort;

  const readable =
    query.readable ??
    (await resolveReadableFieldSet(
      [
        ...output,
        ...operationalFields,
        ...Object.keys(filters),
        ...Object.keys(constraints),
        ...searchFields,
        ...(sort ? [sort.field] : []),
      ],
      resource.options.fieldAccess,
      reqCtx,
    ));
  const fields = output.filter((field) => readable.has(field));
  const constraintEntries = Object.entries(constraints);
  if (constraintEntries.some(([field, value]) => value === undefined || !readable.has(field))) {
    return emptyPage(page, pageSize, fields);
  }
  const searchable = searchFields.filter((field) => readable.has(field));
  const search = query.search ?? "";
  if (strictSearch && searchFields.length > 0 && searchable.length === 0) {
    return emptyPage(page, pageSize, fields);
  }

  const operational = operationalFields.filter((field) => readable.has(field));
  const softDelete = resource.options.delete?.softDelete;
  const base = requestQueryContext(reqCtx);
  const listCtx: ListQueryContext<unknown> = {
    ...base,
    ...(query.dateRange ? { dateRange: query.dateRange } : {}),
    ...(query.searchParams ? { searchParams: query.searchParams } : {}),
    ...(query.signal ? { signal: query.signal } : {}),
    filters: {
      ...Object.fromEntries(Object.entries(filters).filter(([field]) => readable.has(field))),
      ...Object.fromEntries(constraintEntries),
    },
    sort: (sort && readable.has(sort.field) ? sort : null) as ListQueryContext<unknown>["sort"],
    ...(query.stableOrder ? { tiebreak: keyColumns(config, resource) } : {}),
    page,
    pageSize,
    search: searchable.length > 0 ? search : "",
    ...(searchable.length > 0 ? { searchFields: searchable } : {}),
    select: query.countOnly
      ? []
      : selectKnownFields(
          [...fields, ...operational],
          config.adapter.introspect(resource.ref).columns,
        ),
    ...(softDelete
      ? { softDelete: { column: String(softDelete) }, includeDeleted: query.includeDeleted }
      : {}),
    ...scopeBinding(resource, reqCtx),
  };

  const result = await runWithRequestContext(reqCtx, () =>
    config.adapter.list(resource.ref, listCtx),
  );
  const rows = result.rows as Row[];
  return {
    rows: query.countOnly ? [] : rows.map((row) => projectRowFields(row, fields)),
    operational: rows.map((row) => projectRowFields(row, operational)),
    total: result.total ?? rows.length,
    page: result.page ?? page,
    pageSize: result.pageSize ?? pageSize,
    fields,
  };
}
