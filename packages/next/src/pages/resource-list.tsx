import type {
  BulkAction,
  ColumnDef,
  ListQueryContext,
  ResolvedAdminConfig,
  ResourceConfig,
  RowAction,
} from "@flowpanel/core";
import {
  assertResourceScope,
  checkRequireRole,
  humanize,
  runWithRequestContext,
} from "@flowpanel/core";
import {
  DataTableWithDrawerRows,
  ResourceListDeletedToggle,
  ResourceListFilters,
  ResourceListSearch,
  SavedViewsDropdown,
} from "@flowpanel/next/client";
import { Button, PageHeader, ReferenceCell } from "@flowpanel/react";
import type * as React from "react";
import { serializeBulkAction } from "../actions/bulk-action.js";
import { type SerializedRowAction, serializeRowAction } from "../actions/row-action.js";
import { buildHref } from "../runtime/href.js";
import { resourceNavName } from "../runtime/nav.js";
import {
  declaredFieldSet,
  parseListParams,
  resolveFilterSpecs,
  sanitizeFilterValues,
} from "../runtime/parse-list-params.js";
import { prerenderResourceCells } from "../runtime/prerender-cells.js";
import { projectRow } from "../runtime/project-row.js";
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
  const allowedFields = declaredFieldSet({
    columns: resource.options.columns as unknown[],
    filters: resource.options.filters as unknown[] | undefined,
    search: resource.options.search as unknown[] | undefined,
    ...(defaultSortRaw ? { defaultSort: { field: defaultSortRaw.field as string } } : {}),
  });
  const {
    page,
    search,
    sort,
    filters: rawFilters,
  } = parseListParams(searchParams, defaultSort, allowedFields);

  const filterSpecs = await resolveFilterSpecs(resource.options.filters, {
    db: config.adapter.db,
    session: reqCtx.session,
  });
  const filters = sanitizeFilterValues(rawFilters, filterSpecs);

  const softDelete = resource.options.delete?.softDelete;
  const includeDeleted = !!softDelete && searchParams.get("deleted") === "1";
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
    ...(resource.options.search && resource.options.search.length > 0
      ? { searchFields: resource.options.search as string[] }
      : {}),
    ...(softDelete ? { softDelete: { column: String(softDelete) }, includeDeleted } : {}),
    ...scopeBinding(config, resource, reqCtx),
  };

  const result = await runWithRequestContext(reqCtx, () => config.adapter.list(resource.ref, ctx));

  const intro = config.adapter.introspect(resource.ref);
  const metaByField = new Map(intro.columns.map((c) => [c.name, c]));

  const columnDefs = resource.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>>;

  const fkLabels = await resolveReferences<Row>(config, reqCtx, columnDefs, result.rows as Row[]);

  const { columns, prerenderedCells } = prerenderResourceCells<Row>(
    columnDefs,
    result.rows as Row[],
    reqCtx,
    { defaultSortable: true, metaByField },
  );

  const cellsWithRefs: (React.ReactNode | undefined)[][] | undefined = prerenderedCells
    ? prerenderedCells.map((row) => row.slice())
    : fkLabels.size > 0
      ? (result.rows as Row[]).map(() => Array(columns.length).fill(undefined) as React.ReactNode[])
      : undefined;
  if (cellsWithRefs && fkLabels.size > 0) {
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

  const deletedRowKeys: string[] | undefined = softDelete
    ? (result.rows as Row[])
        .filter((row) => row[String(softDelete)] != null)
        .map((row) => String(row[rowKey]))
    : undefined;

  const rawActions = resource.options.actions as RowAction<Row>[] | undefined;
  const serializedActions = rawActions?.map(serializeRowAction) ?? [];
  let rowActionsById: Record<string, SerializedRowAction[]> | undefined;
  if (rawActions?.some((a) => a.hidden)) {
    const entries = await Promise.all(
      (result.rows as Row[]).map(async (row) => {
        const visible: SerializedRowAction[] = [];
        for (const [i, a] of rawActions.entries()) {
          const h = a.hidden;
          if (h && (await h(row, reqCtx))) continue;
          const s = serializedActions[i];
          if (s) visible.push(s);
        }
        return [String(row[rowKey]), visible] as const;
      }),
    );
    rowActionsById = Object.fromEntries(entries);
  }
  const rawBulkActions = resource.options.bulkActions as BulkAction<Row>[] | undefined;
  const serializedBulkActions = rawBulkActions?.map(serializeBulkAction) ?? [];
  const displayPlural = resource.options.plural ?? resource.options.label ?? humanize(name);

  const clientRows = (result.rows as Row[]).map((row) => projectRow(resource, row));

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
        {softDelete ? <ResourceListDeletedToggle /> : null}
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
        rows={clientRows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        rowKey={rowKey as keyof Row & string}
        {...(resource.options.density ? { density: resource.options.density } : {})}
        {...(resource.options.export ? { exportable: resource.options.export } : {})}
        {...(resource.options.import
          ? {
              importable: {
                resource: name,
                formats: resource.options.import.formats ?? ["csv", "json"],
              },
            }
          : {})}
        {...(sort ? { sort: sort as { field: keyof Row & string; dir: "asc" | "desc" } } : {})}
        {...(cellsWithRefs ? { prerenderedCells: cellsWithRefs } : {})}
        {...(serializedActions.length > 0 ? { rowActions: serializedActions } : {})}
        {...(rowActionsById ? { rowActionsById } : {})}
        {...(serializedBulkActions.length > 0 ? { bulkActions: serializedBulkActions } : {})}
        {...(deletedRowKeys && deletedRowKeys.length > 0 ? { deletedRowKeys } : {})}
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
