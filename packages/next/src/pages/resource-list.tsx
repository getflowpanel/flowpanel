import type {
  FilterDef,
  ListQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  assertResourceScope,
  DEFAULT_LABELS,
  formatLabel,
  resolveFormatting,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import {
  DataTableWithDrawerRows,
  ResourceListDeletedToggle,
  ResourceListFilters,
  ResourceListSearch,
  SavedViewsDropdown,
} from "@flowpanel/next/client";
import { PageHeader } from "@flowpanel/react";
import { DEFAULT_RESOURCE_PAGE_SIZE } from "../runtime/defaults";
import { resourceNavName } from "../runtime/nav";
import {
  parseListParams,
  resolveFilterSpecs,
  sanitizeFilterValues,
  withFilterDefaults,
} from "../runtime/parse-list-params";
import { prerenderResourceCells } from "../runtime/prerender-cells";
import { projectRowFields, selectKnownFields } from "../runtime/project-row";
import { readOrCard } from "../runtime/query-error";
import { resolveReadableListSurface } from "../runtime/readable-list";
import { applyReferenceCells } from "../runtime/reference-cells";
import { buildRequestContext } from "../runtime/request-setup";
import { requireAccessIfSet } from "../runtime/require-access";
import { resolveReferences } from "../runtime/resolve-references";
import { labelInSentence, pluralLabel } from "../runtime/resource-title";
import { detailRowHrefs, resolveRowClick } from "../runtime/row-click";
import { rowIdentity, rowKeyOf } from "../runtime/row-identity";
import { wireViews } from "../runtime/saved-views";
import { scopeBinding } from "../runtime/scope-binding";
import { resolveResourceListActions } from "./resource-list-actions";
import { buildResourceListCreateAction } from "./resource-list-create-action";
import { listEmptyProps } from "./resource-list-empty";

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
  await requireAccessIfSet(resolveOperationAccess(resource.options.access, "read"), reqCtx);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope,
  });

  const name = resourceNavName(resource);
  const configuredPageSize = resource.options.pageSize ?? DEFAULT_RESOURCE_PAGE_SIZE;
  // Match attacker-controlled `?perPage=` to the offered bounded options.
  const pageSizeOptions = pageSizeChoices(configuredPageSize);
  const requestedPageSize = Number(searchParams.get("perPage"));
  const pageSize = pageSizeOptions.includes(requestedPageSize)
    ? requestedPageSize
    : configuredPageSize;
  const softDelete = resource.options.delete?.softDelete;
  const readable = await resolveReadableListSurface(
    resource,
    reqCtx,
    searchParams,
    softDelete ? [String(softDelete)] : [],
  );
  const {
    page,
    search,
    sort,
    filters: rawFilters,
  } = parseListParams(searchParams, readable.defaultSort, readable.fields);

  const timeZone = resolveFormatting(config.formatting).timeZone;
  const filterSpecs = await resolveFilterSpecs(
    readable.filters as Array<keyof Row | FilterDef<Row>>,
    reqCtx,
    timeZone,
    searchParams,
  );
  const filters = sanitizeFilterValues(
    withFilterDefaults(rawFilters, filterSpecs),
    filterSpecs,
    timeZone,
  );
  const effectiveSearch = readable.searchFields.length > 0 ? search : "";

  const includeDeleted = !!softDelete && searchParams.get("deleted") === "1";
  const ctx: ListQueryContext<unknown> = {
    ...reqCtx,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: readable.searchParams,
    signal: new AbortController().signal,
    filters,
    sort: sort as ListQueryContext<unknown>["sort"],
    page,
    pageSize,
    search: effectiveSearch,
    select: selectKnownFields(
      [...readable.rowFields, ...readable.operationalFields],
      config.adapter.introspect(resource.ref).columns,
    ),
    ...(readable.searchFields.length > 0 ? { searchFields: readable.searchFields } : {}),
    ...(softDelete ? { softDelete: { column: String(softDelete) }, includeDeleted } : {}),
    ...scopeBinding(resource, reqCtx),
  };

  const listed = await readOrCard(
    {
      config,
      resource: name,
      operation: "list",
      ...(reqCtx.requestId ? { requestId: reqCtx.requestId } : {}),
    },
    async () => runWithRequestContext(reqCtx, () => config.adapter.list(resource.ref, ctx)),
  );
  if (listed.failed) return listed.card;
  const result = listed.value;
  const clientRows = (result.rows as Row[]).map((row) => projectRowFields(row, readable.rowFields));

  const intro = config.adapter.introspect(resource.ref);
  const metaByField = new Map(intro.columns.map((c) => [c.name, c]));

  const columnDefs = readable.columns;

  const fkLabels = await resolveReferences<Row>(config, reqCtx, columnDefs, clientRows);

  const { columns, prerenderedCells } = prerenderResourceCells<Row>(
    columnDefs,
    clientRows,
    reqCtx,
    { defaultSortable: true, metaByField },
  );

  const cellsWithRefs = applyReferenceCells(
    config,
    columnDefs,
    columns,
    clientRows,
    prerenderedCells,
    fkLabels,
  );

  const rowKey = rowKeyOf(resource);
  const rowClick = resolveRowClick(resource);
  const rowHrefs =
    rowClick === "detail" ? detailRowHrefs(config, name, clientRows, rowKey) : undefined;

  const deletedRowKeys: string[] | undefined =
    softDelete && readable.operationalFields.includes(String(softDelete))
      ? (result.rows as Row[])
          .filter((row) => row[String(softDelete)] != null)
          .flatMap((row) => {
            const id = rowIdentity(row, rowKey);
            return id === null ? [] : [id];
          })
      : undefined;

  const { rowActions, rowActionsById, bulkActions } = await resolveResourceListActions<Row>(
    resource,
    clientRows,
    rowKey,
    reqCtx,
  );
  const displayPlural = pluralLabel(resource, name);
  const createdRowKeyParam = searchParams.get("fp_created");
  const createdRowKey =
    createdRowKeyParam && createdRowKeyParam.length <= 512 ? createdRowKeyParam : undefined;

  const createAction = await buildResourceListCreateAction({ config, resource, name, reqCtx });

  return (
    <>
      <PageHeader title={displayPlural} {...(createAction ? { actions: createAction } : {})} />
      {/* Search sits in the filter row, not above it — one band of chrome. */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {readable.searchFields.length > 0 ? (
          <ResourceListSearch
            placeholder={
              config.labels?.searchPlaceholder === undefined
                ? formatLabel(DEFAULT_LABELS.searchPlaceholder, {
                    label: labelInSentence(displayPlural),
                  })
                : formatLabel(config.labels.searchPlaceholder, { label: displayPlural })
            }
          />
        ) : null}
        <div className="flex-1">
          <ResourceListFilters filters={filterSpecs} />
        </div>
        {softDelete ? <ResourceListDeletedToggle /> : null}
        <SavedViewsDropdown resource={name} staticViews={wireViews(resource, timeZone)} />
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
        {...(createdRowKey ? { enteringRowKeys: [createdRowKey], createdRowKey } : {})}
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
        {...(rowActions.length > 0 ? { rowActions } : {})}
        {...(rowActionsById ? { rowActionsById } : {})}
        {...(bulkActions.length > 0 ? { bulkActions } : {})}
        {...(deletedRowKeys && deletedRowKeys.length > 0 ? { deletedRowKeys } : {})}
        {...(rowClick === "drawer" ? { openDrawerOnRowClick: true } : {})}
        {...(rowHrefs ? { rowHrefs } : {})}
        {...(resource.options.realtime
          ? {
              realtime:
                resource.options.realtime === true ? `resource.${name}` : resource.options.realtime,
            }
          : {})}
        {...listEmptyProps(config, resource, name, displayPlural, {
          filtered: effectiveSearch !== "" || Object.keys(filters).length > 0,
          params: searchParams,
          search: effectiveSearch,
          defaulted: filterSpecs.filter((f) => f.defaultValue !== undefined && !f.hidden),
        })}
      />
    </>
  );
}
