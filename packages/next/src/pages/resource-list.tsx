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
import { DataTableWithDrawerRows } from "@flowpanel/next/client";
import { Button, DataTable, type DataTableColumn, PageHeader } from "@flowpanel/react";
import { resourceNavName } from "../runtime/nav.js";
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
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const search = searchParams.get("q") ?? "";
  const sortField = searchParams.get("sort");
  const sortDir: "asc" | "desc" = searchParams.get("dir") === "asc" ? "asc" : "desc";
  const sort: { field: string; dir: "asc" | "desc" } | null = sortField
    ? { field: sortField, dir: sortDir }
    : resource.options.defaultSort
      ? {
          field: resource.options.defaultSort.field as string,
          dir: resource.options.defaultSort.dir,
        }
      : null;

  const filters: Record<string, unknown> = {};
  for (const [k, v] of searchParams.entries()) {
    if (k === "page" || k === "q" || k === "sort" || k === "dir") continue;
    filters[k] = v;
  }

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
