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
import { projectAuthorizedRow } from "./project-row.js";
import { scopeBinding } from "./scope-binding.js";

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

  const softDelete = target.options.delete?.softDelete;
  const listCtx: ListQueryContext<unknown> = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: opts.dateRange ?? { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    filters: opts.filters ?? {},
    sort: (opts.sort ?? null) as ListQueryContext<unknown>["sort"],
    page: opts.page ?? 1,
    pageSize: opts.pageSize ?? 20,
    search: opts.search ?? "",
    ...(opts.searchFields ? { searchFields: opts.searchFields } : {}),
    ...(softDelete ? { softDelete: { column: String(softDelete) } } : {}),
    ...scopeBinding(config, target, reqCtx),
  };

  const result = await runWithRequestContext(reqCtx, () =>
    config.adapter.list(target.ref, listCtx),
  );
  return Promise.all(
    (result.rows as Record<string, unknown>[]).map((row) =>
      projectAuthorizedRow(target, row, reqCtx, opts.extraFields),
    ),
  );
}
