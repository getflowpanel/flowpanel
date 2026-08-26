import type {
  BulkAction,
  ColumnDef,
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  RowAction,
} from "@flowpanel/core";
import {
  assertResourceScope,
  authorizeOperation,
  checkRequireRole,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import {
  CreateDrawer,
  DataTableWithDrawerRows,
  ResourceListDeletedToggle,
  ResourceListFilters,
  ResourceListSearch,
  SavedViewsDropdown,
} from "@flowpanel/next/client";
import { AutoForm, Button, FlowpanelIcon, PageHeader } from "@flowpanel/react";
import { serializeBulkAction } from "../actions/bulk-action";
import { type SerializedRowAction, serializeRowAction } from "../actions/row-action";
import { filterActionsByAccess } from "../runtime/action-helpers";
import { DEFAULT_RESOURCE_PAGE_SIZE, DEFAULT_RESOURCE_ROW_KEY } from "../runtime/defaults";
import { buildHref } from "../runtime/href";
import { resourceNavName } from "../runtime/nav";
import {
  declaredFieldSet,
  parseListParams,
  resolveFilterSpecs,
  sanitizeFilterValues,
} from "../runtime/parse-list-params";
import { prerenderResourceCells } from "../runtime/prerender-cells";
import { projectAuthorizedRow } from "../runtime/project-row";
import { applyReferenceCells } from "../runtime/reference-cells";
import { buildRequestContext } from "../runtime/request-setup";
import { declaredFormFields, resolveFormFields } from "../runtime/resolve-form-fields";
import { resolveReferences } from "../runtime/resolve-references";
import { pluralLabel, singularLabel } from "../runtime/resource-title";
import { scopeBinding } from "../runtime/scope-binding";

export interface ResourceListPageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  searchParams: URLSearchParams;
  req: Request;
  reqCtx?: RequestContext;
}

type Row = Record<string, unknown>;

/** The sizes the pager may offer, with the resource's own always among them. */
function pageSizeChoices(configured: number): number[] {
  return [...new Set([10, 20, 50, 100, configured])].sort((a, b) => a - b);
}

export async function ResourceListPage({
  config,
  resource,
  searchParams,
  req,
  reqCtx: providedReqCtx,
}: ResourceListPageProps) {
  const reqCtx = providedReqCtx ?? (await buildRequestContext({ req, config }));
  checkRequireRole(resource.options.requireRole, reqCtx.role, reqCtx.session);
  await authorizeOperation(
    resolveOperationAccess(resource.options.access, resource.options.requireRole, "read"),
    reqCtx,
  );
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });

  const name = resourceNavName(resource);
  const configuredPageSize = resource.options.pageSize ?? DEFAULT_RESOURCE_PAGE_SIZE;
  // Match attacker-controlled `?perPage=` to the offered bounded options.
  const pageSizeOptions = pageSizeChoices(configuredPageSize);
  const requestedPageSize = Number(searchParams.get("perPage"));
  const pageSize = pageSizeOptions.includes(requestedPageSize)
    ? requestedPageSize
    : configuredPageSize;
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

  const cellsWithRefs = applyReferenceCells(
    config,
    columnDefs,
    columns,
    result.rows as Row[],
    prerenderedCells,
    fkLabels,
  );

  const rowKey = (resource.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY;
  const useDrawerRowClick = resource.options.rowClick === "drawer" && !!resource.options.drawer;

  const deletedRowKeys: string[] | undefined = softDelete
    ? (result.rows as Row[])
        .filter((row) => row[String(softDelete)] != null)
        .map((row) => String(row[rowKey]))
    : undefined;

  const rawActions = await filterActionsByAccess(
    resource.options.actions as RowAction<Row>[] | undefined,
    reqCtx,
  );
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
  const rawBulkActions = await filterActionsByAccess(
    resource.options.bulkActions as BulkAction<Row>[] | undefined,
    reqCtx,
  );
  const serializedBulkActions = rawBulkActions?.map(serializeBulkAction) ?? [];
  const displayPlural = pluralLabel(resource, name);

  const clientRows = await Promise.all(
    (result.rows as Row[]).map((row) => projectAuthorizedRow(resource, row, reqCtx)),
  );

  // Reuse the server-rendered /new AutoForm inside the client drawer, with no extra fetch.
  const createDeclared = resource.options.create?.disabled
    ? undefined
    : declaredFormFields(resource, "create");
  const createFields = createDeclared
    ? await resolveFormFields(config, createDeclared, reqCtx)
    : undefined;
  const createLabel = singularLabel(resource, name);

  return (
    <>
      <PageHeader
        title={displayPlural}
        {...(resource.options.create?.disabled
          ? {}
          : {
              actions: (
                <CreateDrawer label="Add new" title={`New ${createLabel}`}>
                  <AutoForm
                    action={`${config.paths.api}/${name}/create`}
                    columns={config.adapter.introspect(resource.ref).columns}
                    {...(createFields ? { fields: createFields } : {})}
                    submitLabel="Create"
                    redirectTo={buildHref(config, name)}
                  />
                </CreateDrawer>
              ),
            })}
      />
      {/* Search sits in the filter row, not above it — one band of chrome. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {resource.options.search && resource.options.search.length > 0 ? (
          <ResourceListSearch placeholder={`Search ${displayPlural}…`} />
        ) : null}
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
        pageSizeOptions={pageSizeOptions}
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
        {...(resource.options.empty?.icon
          ? {
              emptyIcon: <FlowpanelIcon name={resource.options.empty.icon} className="h-6 w-6" />,
            }
          : {})}
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
