import type {
  ColumnDef,
  ListQueryContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  assertResourceScope,
  checkRequireRole,
  type RequireRole,
  runWithRequestContext,
} from "@flowpanel/core";
import {
  DataTableWithDrawerRows,
  ResourceListFilters,
  ResourceListSearch,
} from "@flowpanel/next/client";
import { Button, DataTable, type DataTableColumn, humanize, PageHeader } from "@flowpanel/react";
import type { ReactNode } from "react";
import { resourceNavName } from "../runtime/nav.js";
import { parseListParams, resolveFilterSpecs } from "../runtime/parse-list-params.js";
import { buildRequestContext } from "../runtime/request-setup.js";

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
  const { page, search, sort, filters } = parseListParams(searchParams, defaultSort);

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
  };

  const result = await runWithRequestContext(reqCtx, () => config.adapter.list(resource.ref, ctx));

  // Build the wire-safe column metadata for `<DataTable>`. `ColumnDef.render`
  // is intentionally NOT carried across the RSC boundary — function refs
  // crash with "Functions cannot be passed directly to Client Components".
  // Instead we run `render` server-side below to produce a ReactNode tree,
  // and pass it as `prerenderedCells`.
  const renderFns: ((row: Row) => ReactNode)[] = [];
  const columns: DataTableColumn<Row>[] = resource.options.columns.map((c) => {
    if (typeof c === "string" || typeof c === "number" || typeof c === "symbol") {
      renderFns.push(null as unknown as (row: Row) => ReactNode);
      return { field: String(c), sortable: true };
    }
    const col = c as ColumnDef<Row>;
    if (col.render) {
      const fn = col.render;
      renderFns.push((row: Row) => fn(row, reqCtx));
    } else {
      renderFns.push(null as unknown as (row: Row) => ReactNode);
    }
    const out: DataTableColumn<Row> = {
      field: String(col.field ?? ""),
      ...(col.label ? { label: col.label } : {}),
      sortable: col.sortable ?? true,
      ...(col.width !== undefined ? { width: col.width } : {}),
      ...(col.align ? { align: col.align } : {}),
      ...(col.className ? { className: col.className } : {}),
      ...(col.hidden !== undefined ? { hidden: col.hidden } : {}),
    };
    return out;
  });

  // Eagerly invoke `render(row, ctx)` server-side for every row × column pair
  // that has a renderer. Columns without a renderer get `undefined`, so the
  // client `<DataTable>` falls back to its default `formatCell(row[field])`.
  const hasAnyRenderer = renderFns.some((fn) => fn !== null);
  const prerenderedCells: (ReactNode | undefined)[][] | undefined = hasAnyRenderer
    ? (result.rows as Row[]).map((row) => renderFns.map((fn) => (fn ? fn(row) : undefined)))
    : undefined;

  const rowKey = (resource.options.rowKey as string | undefined) ?? "id";
  const useDrawerRowClick = resource.options.rowClick === "drawer" && !!resource.options.drawer;
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
                  <a href={`/admin/${name}/new`}>Add new</a>
                </Button>
              ),
            })}
      />
      {resource.options.search && resource.options.search.length > 0 ? (
        <ResourceListSearch placeholder={`Search ${displayPlural}…`} />
      ) : null}
      <ResourceListFilters filters={filterSpecs} />
      {useDrawerRowClick ? (
        <DataTableWithDrawerRows
          resource={name}
          columns={columns}
          rows={result.rows as Row[]}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          rowKey={rowKey as keyof Row & string}
          {...(sort ? { sort: sort as { field: keyof Row & string; dir: "asc" | "desc" } } : {})}
          {...(prerenderedCells ? { prerenderedCells } : {})}
          emptyTitle={`No ${displayPlural}`}
        />
      ) : (
        <DataTableWithDrawerRows
          columns={columns}
          rows={result.rows as Row[]}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          rowKey={rowKey as keyof Row & string}
          {...(sort ? { sort: sort as { field: keyof Row & string; dir: "asc" | "desc" } } : {})}
          {...(prerenderedCells ? { prerenderedCells } : {})}
          emptyTitle={`No ${displayPlural}`}
        />
      )}
    </>
  );
}
