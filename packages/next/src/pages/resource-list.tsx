import type {
  BulkAction,
  ColumnDef,
  ListQueryContext,
  ResolvedAdminConfig,
  ResourceConfig,
  RowAction,
} from "@flowpanel/core";
import { assertResourceScope, checkRequireRole, runWithRequestContext } from "@flowpanel/core";
import {
  DataTableWithDrawerRows,
  ResourceListFilters,
  ResourceListSearch,
  SavedViewsDropdown,
} from "@flowpanel/next/client";
import { Button, humanize, PageHeader, ReferenceCell } from "@flowpanel/react";
import type * as React from "react";
import { serializeBulkAction } from "../actions/bulk-action.js";
import { serializeRowAction } from "../actions/row-action.js";
import { buildHref } from "../runtime/href.js";
import { resourceNavName } from "../runtime/nav.js";
import {
  declaredFieldSet,
  parseListParams,
  resolveFilterSpecs,
} from "../runtime/parse-list-params.js";
import { prerenderResourceCells } from "../runtime/prerender-cells.js";
import { buildRequestContext } from "../runtime/request-setup.js";
import { resolveReferences } from "../runtime/resolve-references.js";
import { scopeBinding } from "../runtime/scope-binding.js";

export interface ResourceListPageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  searchParams: URLSearchParams;
  req: Request;
}

type Row = Record<string, unknown>;

export async function ResourceListPage({
  config,
  resource,
  searchParams,
  req,
}: ResourceListPageProps) {
  const reqCtx = await buildRequestContext({ req, config });
  checkRequireRole(resource.options.requireRole, reqCtx.role, reqCtx.session);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });

  const name = resourceNavName(resource);
  const pageSize = resource.options.pageSize ?? 20;
  const defaultSortRaw = resource.options.defaultSort;
  const defaultSort: { field: string; dir: "asc" | "desc" } | undefined = defaultSortRaw
    ? { field: defaultSortRaw.field as string, dir: defaultSortRaw.dir }
    : undefined;
  // Allowlist filter keys + sort field against the resource's declared
  // columns / filters / search — closes the unvalidated-filter/sort
  // data-oracle (consistent across adapters).
  const allowedFields = declaredFieldSet({
    columns: resource.options.columns as unknown[],
    filters: resource.options.filters as unknown[] | undefined,
    search: resource.options.search as unknown[] | undefined,
    ...(defaultSortRaw ? { defaultSort: { field: defaultSortRaw.field as string } } : {}),
  });
  const { page, search, sort, filters } = parseListParams(searchParams, defaultSort, allowedFields);

  const filterSpecs = await resolveFilterSpecs(resource.options.filters, {
    db: config.adapter.db,
    session: reqCtx.session,
  });

  const softDelete = resource.options.delete?.softDelete;
  const ctx: ListQueryContext<unknown> = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams,
    signal: new AbortController().signal,
    filters,
    sort: sort as ListQueryContext<unknown>["sort"],
    page,
    pageSize,
    search,
    ...(softDelete ? { softDelete: { column: String(softDelete) } } : {}),
    ...scopeBinding(config, resource, reqCtx),
  };

  const result = await runWithRequestContext(reqCtx, () => config.adapter.list(resource.ref, ctx));

  // Build the wire-safe column metadata for `<DataTable>`. `ColumnDef.render`
  // is intentionally NOT carried across the RSC boundary — function refs
  // crash with "Functions cannot be passed directly to Client Components".
  // The shared helper executes `render(row, reqCtx)` server-side and returns
  // a `prerenderedCells` matrix the client falls back to before its own
  // `c.render` / `formatCell` chain.
  // Forward adapter introspection (column types: array / json / reference /
  // …) so DataTable can dispatch to type-aware cell renderers without a
  // second per-page request.
  const intro = config.adapter.introspect(resource.ref);
  const metaByField = new Map(intro.columns.map((c) => [c.name, c]));

  const columnDefs = resource.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>>;

  // Batch-resolve foreign-key labels server-side. One PK lookup per unique
  // FK value per column — overlapped via `Promise.all`. Failures (deleted
  // target row, unregistered target resource) fall back to the raw value.
  const fkLabels = await resolveReferences<Row>(config, reqCtx, columnDefs, result.rows as Row[]);

  const { columns, prerenderedCells } = prerenderResourceCells<Row>(
    columnDefs,
    result.rows as Row[],
    reqCtx,
    { defaultSortable: true, metaByField },
  );

  // Inject resolved `<ReferenceCell>` into the prerendered grid. Done after
  // the main prerender to keep that helper pure (no DB access).
  const cellsWithRefs: (React.ReactNode | undefined)[][] | undefined = prerenderedCells
    ? prerenderedCells.map((row) => row.slice())
    : fkLabels.size > 0
      ? (result.rows as Row[]).map(() => Array(columns.length).fill(undefined) as React.ReactNode[])
      : undefined;
  if (cellsWithRefs && fkLabels.size > 0) {
    // Build a lookup by column index for fast injection.
    const colIdxByField = new Map<string, number>();
    columns.forEach((c, i) => {
      colIdxByField.set(c.field as string, i);
    });
    const refMetaByField = new Map<string, { resource: string; labelField: string }>();
    for (const c of columnDefs) {
      if (typeof c === "string" || typeof c === "number" || typeof c === "symbol") continue;
      const def = c as ColumnDef<Row>;
      const ref = def.reference;
      const field = String(def.field ?? "");
      if (ref && field) refMetaByField.set(field, ref);
    }
    (result.rows as Row[]).forEach((row, rowIdx) => {
      const rowCells = cellsWithRefs[rowIdx];
      if (!rowCells) return;
      for (const [field, labelMap] of fkLabels) {
        const colIdx = colIdxByField.get(field);
        if (colIdx === undefined) continue;
        const ref = refMetaByField.get(field);
        if (!ref) continue;
        const raw = row[field as keyof Row];
        if (raw === null || raw === undefined) {
          rowCells[colIdx] = <span className="text-fp-text-3">—</span>;
          continue;
        }
        const id = String(raw);
        const label = labelMap.get(id);
        if (label === undefined) continue; // leaves the raw-value fallback
        rowCells[colIdx] = (
          <ReferenceCell label={String(label)} href={buildHref(config, ref.resource, id)} />
        );
      }
    });
  }

  const rowKey = (resource.options.rowKey as string | undefined) ?? "id";
  const useDrawerRowClick = resource.options.rowClick === "drawer" && !!resource.options.drawer;

  // Strip runtime callbacks (`run`, `hidden`, `disabled`) before crossing the
  // RSC → client boundary. The serialized wire shape carries just enough to
  // render the menu; the server route re-evaluates everything on POST.
  const rawActions = resource.options.actions as RowAction<Row>[] | undefined;
  const serializedActions = rawActions?.map(serializeRowAction) ?? [];
  const rawBulkActions = resource.options.bulkActions as BulkAction<Row>[] | undefined;
  const serializedBulkActions = rawBulkActions?.map(serializeBulkAction) ?? [];
  const displayPlural = resource.options.plural ?? resource.options.label ?? humanize(name);

  return (
    <>
      <PageHeader
        title={displayPlural}
        {...(resource.options.create?.disabled
          ? {}
          : {
              actions: (
                <Button asChild>
                  <a href={buildHref(config, name, "new")}>Add new</a>
                </Button>
              ),
            })}
      />
      {resource.options.search && resource.options.search.length > 0 ? (
        <ResourceListSearch placeholder={`Search ${displayPlural}…`} />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1">
          <ResourceListFilters filters={filterSpecs} />
        </div>
        <SavedViewsDropdown
          resource={name}
          staticViews={
            (resource.options.views as ReadonlyArray<
              Parameters<typeof SavedViewsDropdown>[0]["staticViews"][number]
            >) ?? []
          }
        />
      </div>
      <DataTableWithDrawerRows
        resource={name}
        columns={columns}
        rows={result.rows as Row[]}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        rowKey={rowKey as keyof Row & string}
        {...(sort ? { sort: sort as { field: keyof Row & string; dir: "asc" | "desc" } } : {})}
        {...(cellsWithRefs ? { prerenderedCells: cellsWithRefs } : {})}
        {...(serializedActions.length > 0 ? { rowActions: serializedActions } : {})}
        {...(serializedBulkActions.length > 0 ? { bulkActions: serializedBulkActions } : {})}
        {...(useDrawerRowClick ? { openDrawerOnRowClick: true } : {})}
        {...(resource.options.realtime
          ? {
              realtime:
                resource.options.realtime === true ? `resource.${name}` : resource.options.realtime,
            }
          : {})}
        emptyTitle={resource.options.empty?.title ?? `No ${displayPlural}`}
        {...(resource.options.empty?.description
          ? { emptyDescription: resource.options.empty.description }
          : {})}
        {...(resource.options.empty?.icon ? { emptyIcon: resource.options.empty.icon } : {})}
        {...(resource.options.empty?.action
          ? {
              emptyAction: (
                <Button asChild>
                  <a href={resource.options.empty.action.href}>
                    {resource.options.empty.action.label}
                  </a>
                </Button>
              ),
            }
          : {})}
      />
    </>
  );
}
