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
import { DataTableWithDrawerRows, ResourceListFilters } from "@flowpanel/next/client";
import { Button, DataTable, type DataTableColumn, PageHeader } from "@flowpanel/react";
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
  checkRequireRole(resource.options.requireRole as RequireRole, reqCtx.role, reqCtx.session);
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

  const ctx: ListQueryContext<Row> = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams,
    signal: new AbortController().signal,
    filters,
    sort: sort as ListQueryContext<Row>["sort"],
    page,
    pageSize,
    search,
  };

  const result = await runWithRequestContext(reqCtx, () => config.adapter.list(resource.ref, ctx));

  const columns: DataTableColumn<Row>[] = resource.options.columns.map((c) => {
    if (typeof c === "string" || typeof c === "number" || typeof c === "symbol") {
      return { field: String(c) };
    }
    const col = c as ColumnDef<Row>;
    const out: DataTableColumn<Row> = {
      field: String(col.field ?? ""),
      ...(col.label ? { label: col.label } : {}),
      ...(col.render ? { render: (row: Row) => col.render?.(row, reqCtx) } : {}),
      ...(col.sortable !== undefined ? { sortable: col.sortable } : {}),
      ...(col.width !== undefined ? { width: col.width } : {}),
      ...(col.align ? { align: col.align } : {}),
      ...(col.className ? { className: col.className } : {}),
      ...(col.hidden !== undefined ? { hidden: col.hidden } : {}),
    };
    return out;
  });

  const rowKey = (resource.options.rowKey as string | undefined) ?? "id";
  const useDrawerRowClick = resource.options.rowClick === "drawer" && !!resource.options.drawer;

  return (
    <>
      <PageHeader
        title={resource.options.plural ?? resource.options.label ?? name}
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
          emptyTitle={`No ${resource.options.plural ?? name}`}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={result.rows as Row[]}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          rowKey={rowKey as keyof Row & string}
          {...(sort ? { sort: sort as { field: keyof Row & string; dir: "asc" | "desc" } } : {})}
          emptyTitle={`No ${resource.options.plural ?? name}`}
        />
      )}
    </>
  );
}
