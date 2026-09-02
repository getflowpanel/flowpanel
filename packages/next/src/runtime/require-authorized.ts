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
import { declaredRowFields, projectRowFields } from "./project-row";
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
export async function readRelatedRows(
  config: ResolvedAdminConfig,
  target: ResourceConfig,
  reqCtx: RequestContext,
  opts: RelatedReadOptions = {},
): Promise<Record<string, unknown>[] | null> {
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

  const filters = opts.filters ?? {};
  const filterFields = Object.keys(filters);
  // A missing projected relationship value must not turn a related query into
  // an unfiltered list.
  if (Object.values(filters).some((value) => value === undefined)) return [];
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
  if (filterFields.some((field) => !readable.has(field))) return [];
  const searchFields = requestedSearchFields.filter((field) => readable.has(field));
  if (requestedSearchFields.length > 0 && searchFields.length === 0) return [];
  const sort = opts.sort && readable.has(opts.sort.field) ? opts.sort : null;
  const projectedFields = [...outputFields].filter((field) => readable.has(field));
  const knownColumns = new Set(
    config.adapter.introspect(target.ref).columns.map((column) => column.name),
  );
  const select = projectedFields.filter((field) => knownColumns.has(field));

  const softDelete = target.options.delete?.softDelete;
  const listCtx: ListQueryContext<unknown> = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: opts.dateRange ?? { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    filters,
    sort: sort as ListQueryContext<unknown>["sort"],
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 20,
    search: searchFields.length > 0 ? (opts.search ?? "") : "",
    ...(searchFields.length > 0 ? { searchFields } : {}),
    ...(select.length > 0 ? { select } : {}),
    ...(softDelete
      ? { softDelete: { column: String(softDelete) }, includeDeleted: opts.includeDeleted }
      : {}),
    ...scopeBinding(config, target, reqCtx),
  };

  const result = await runWithRequestContext(reqCtx, () =>
    config.adapter.list(target.ref, listCtx),
  );
  return (result.rows as Record<string, unknown>[]).map((row) =>
    projectRowFields(row, projectedFields),
  );
}
