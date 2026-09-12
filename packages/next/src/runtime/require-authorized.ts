import {
  assertResourceScope,
  authorizeOperation,
  checkRequireRole,
  FlowpanelAccessError,
  type ListQueryContext,
  type RequestContext,
  type ResolvedAdminConfig,
  type ResourceConfig,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { declaredRowFields, projectRowFields, selectKnownFields } from "./project-row";
import { resolveReadableFieldSet } from "./readable-fields";
import { scopeBinding } from "./scope-binding";

/** Runs the resource's role + scope checks. */
export function requireAuthorized(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
): void {
  checkRequireRole(resource.options.requireRole, reqCtx.role, reqCtx.session);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });
}

export interface RelatedReadOptions {
  filters?: Record<string, unknown>;
  sort?: { field: string; dir: "asc" | "desc" };
  page?: number;
  pageSize?: number;
  search?: string;
  searchFields?: string[];
  dateRange?: { from: Date; to: Date };
  /** Kept on top of the target's declared fields — a label field, a primary key. */
  extraFields?: Iterable<string>;
  /** Reach soft-deleted rows too, so a reference to one still resolves its label. */
  includeDeleted?: boolean;
}

/**
 * The only sanctioned way to read a resource other than the request's own.
 * `null` means the caller may not read `target` — each site decides whether
 * that degrades to empty or answers with an error.
 */
export interface RelatedPage {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

/** Rows only, for reference, drawer and widget consumers that never paginate. */
export async function readRelatedRows(
  config: ResolvedAdminConfig,
  target: ResourceConfig,
  reqCtx: RequestContext,
  opts: RelatedReadOptions = {},
): Promise<Record<string, unknown>[] | null> {
  return (await readRelatedPage(config, target, reqCtx, opts))?.rows ?? null;
}

/**
 * The same authorized related read, with the adapter's own total, so a history
 * longer than one page stays reachable.
 */
export async function readRelatedPage(
  config: ResolvedAdminConfig,
  target: ResourceConfig,
  reqCtx: RequestContext,
  opts: RelatedReadOptions = {},
): Promise<RelatedPage | null> {
  try {
    requireAuthorized(config, target, reqCtx);
    await authorizeOperation(
      resolveOperationAccess(target.options.access, target.options.requireRole, "read"),
      reqCtx,
    );
  } catch (err) {
    if (err instanceof FlowpanelAccessError) return null;
    throw err;
  }

  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 20;
  const empty: RelatedPage = { rows: [], total: 0, page, pageSize };
  const filters = opts.filters ?? {};
  const filterFields = Object.keys(filters);
  // A missing projected relationship value must not turn a related query into
  // an unfiltered list.
  if (Object.values(filters).some((value) => value === undefined)) return empty;
  const requestedSearchFields = opts.searchFields ?? [];
  const requestedSortField = opts.sort?.field;
  const outputFields = declaredRowFields(target);
  for (const field of opts.extraFields ?? []) outputFields.add(field);
  const readable = await resolveReadableFieldSet(
    [
      ...outputFields,
      ...filterFields,
      ...requestedSearchFields,
      ...(requestedSortField ? [requestedSortField] : []),
    ],
    target.options.fieldAccess,
    reqCtx,
  );
  // Relationship filters are constraints, not optional user refinements. If
  // policy removes one, fail closed instead of widening the related result.
  if (filterFields.some((field) => !readable.has(field))) return empty;
  const searchFields = requestedSearchFields.filter((field) => readable.has(field));
  if (requestedSearchFields.length > 0 && searchFields.length === 0) return empty;
  const sort = opts.sort && readable.has(opts.sort.field) ? opts.sort : null;
  const projectedFields = [...outputFields].filter((field) => readable.has(field));
  const select = selectKnownFields(projectedFields, config.adapter.introspect(target.ref).columns);

  const softDelete = target.options.delete?.softDelete;
  const listCtx: ListQueryContext<unknown> = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: opts.dateRange ?? { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    filters,
    sort: sort as ListQueryContext<unknown>["sort"],
    page,
    pageSize,
    search: searchFields.length > 0 ? (opts.search ?? "") : "",
    ...(searchFields.length > 0 ? { searchFields } : {}),
    select,
    ...(softDelete
      ? { softDelete: { column: String(softDelete) }, includeDeleted: opts.includeDeleted }
      : {}),
    ...scopeBinding(config, target, reqCtx),
  };

  const result = await runWithRequestContext(reqCtx, () =>
    config.adapter.list(target.ref, listCtx),
  );
  const rows = (result.rows as Record<string, unknown>[]).map((row) =>
    projectRowFields(row, projectedFields),
  );
  return {
    rows,
    total: result.total ?? rows.length,
    page: result.page ?? page,
    pageSize: result.pageSize ?? pageSize,
  };
}
