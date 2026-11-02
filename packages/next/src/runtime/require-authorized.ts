import {
  assertResourceScope,
  FlowpanelAccessError,
  type RequestContext,
  type ResolvedAdminConfig,
  type ResourceConfig,
  resolveOperationAccess,
  resolveResourceName,
  runWithRequestContext,
} from "@flowpanel/core";
import { assertCountWhereColumns } from "@flowpanel/core/internal";
import { listReadableRows, requireListAccess } from "./list-rows";
import { declaredRowFields } from "./project-row";
import { resolveReadableFieldSet } from "./readable-fields";
import { requireAccessIfSet } from "./require-access";
import { scopeBinding } from "./scope-binding";

/** Runs the resource's scope check. */
export function requireAuthorized(config: ResolvedAdminConfig, resource: ResourceConfig): void {
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope,
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
  /** Ask the adapter for the total with no columns selected — `ctx.count`'s read. */
  countOnly?: boolean;
}

/**
 * The only sanctioned way to read a resource other than the request's own.
 * `null` means the caller may not read `target` — each site decides whether that degrades to empty or an error.
 */
export interface RelatedPage {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * How many rows of `target` match `filters`, under the same role, access, field and scope checks as a related read.
 * `adapter.count` answers directly only with no tenant predicate; a scoped resource counts through `list` instead.
 */
export async function readRelatedCount(
  config: ResolvedAdminConfig,
  target: ResourceConfig,
  reqCtx: RequestContext,
  filters: Record<string, unknown> = {},
): Promise<number | null> {
  assertCountWhereColumns(
    resolveResourceName(target),
    filters,
    config.adapter.introspect(target.ref).columns.map((column) => column.name),
  );
  // A missing projected value must not turn a filtered count into a total.
  if (Object.values(filters).some((value) => value === undefined)) return 0;
  const direct = config.adapter.count;
  if (!direct || scopeBinding(target, reqCtx).boundScope) {
    const page = await readRelatedPage(config, target, reqCtx, {
      filters,
      page: 1,
      pageSize: 1,
      countOnly: true,
    });
    return page?.total ?? null;
  }

  try {
    requireAuthorized(config, target);
    await requireAccessIfSet(resolveOperationAccess(target.options.access, "read"), reqCtx);
  } catch (err) {
    if (err instanceof FlowpanelAccessError) return null;
    throw err;
  }
  const filterFields = Object.keys(filters);
  const readable = await resolveReadableFieldSet(filterFields, target.options.fieldAccess, reqCtx);
  // Counting by a field the role cannot read is an oracle over its values.
  if (filterFields.some((field) => !readable.has(field))) return 0;

  const softDelete = target.options.delete?.softDelete;
  const where = softDelete ? { [String(softDelete)]: "__null__", ...filters } : filters;
  return runWithRequestContext(reqCtx, () => direct(target.ref, where));
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
 * longer than one page stays reachable. `filters` are relationship constraints:
 * a field the caller cannot read, or a missing value, empties the page.
 */
export async function readRelatedPage(
  config: ResolvedAdminConfig,
  target: ResourceConfig,
  reqCtx: RequestContext,
  opts: RelatedReadOptions = {},
): Promise<RelatedPage | null> {
  try {
    await requireListAccess(config, target, reqCtx);
  } catch (err) {
    if (err instanceof FlowpanelAccessError) return null;
    throw err;
  }
  const page = await listReadableRows(config, target, reqCtx, {
    constraints: opts.filters ?? {},
    ...(opts.sort ? { sort: opts.sort } : {}),
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 20,
    search: opts.search ?? "",
    ...(opts.searchFields ? { searchFields: opts.searchFields } : {}),
    fields: [...declaredRowFields(target), ...(opts.extraFields ?? [])],
    ...(opts.includeDeleted !== undefined ? { includeDeleted: opts.includeDeleted } : {}),
    ...(opts.countOnly ? { countOnly: true } : {}),
    ...(opts.dateRange ? { dateRange: opts.dateRange } : {}),
  });
  return { rows: page.rows, total: page.total, page: page.page, pageSize: page.pageSize };
}
