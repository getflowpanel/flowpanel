import type { RequestContext, ResolvedAdminConfig, ResourceConfig } from "@flowpanel/core";
import {
  assertResourceScope,
  DEFAULT_LABELS,
  formatLabel,
  mergeLabels,
  resolveFormatting,
  resolveOperationAccess,
} from "@flowpanel/core";
import {
  DataTableWithDrawerRows,
  ListNavigationProvider,
  ResourceListDeletedToggle,
  ResourceListFilters,
  ResourceListSearch,
  SavedViewsDropdown,
} from "@flowpanel/next/client";
import { FilterSheet, PageHeader } from "@flowpanel/react";
import { exportTarget, targetAllows } from "../runtime/action-gate";
import { DEFAULT_RESOURCE_PAGE_SIZE } from "../runtime/defaults";
import { listRequestFromParams } from "../runtime/list-request";
import { listRows } from "../runtime/list-rows";
import { resourceNavName } from "../runtime/nav";
import { prerenderResourceCells } from "../runtime/prerender-cells";
import { readOrCard } from "../runtime/query-error";
import { applyReferenceCells } from "../runtime/reference-cells";
import { buildRequestContext } from "../runtime/request-setup";
import { requireAccessIfSet } from "../runtime/require-access";
import { resolveReferences } from "../runtime/resolve-references";
import { labelInSentence, pluralLabel, singularLabel } from "../runtime/resource-title";
import { detailRowHrefs, resolveRowClick } from "../runtime/row-click";
import { rowIdentity, rowKeyOf } from "../runtime/row-identity";
import { wireViews } from "../runtime/saved-views";
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

/** What the list shows with nothing in its URL: each filter's default and the resource's sort. */
function listDefaults(
  specs: ReadonlyArray<{ field: string; defaultValue?: string; hidden?: boolean }>,
  resource: ResourceConfig,
): { filters: Record<string, string>; sort?: { field: string; dir: "asc" | "desc" } } {
  const filters: Record<string, string> = {};
  for (const spec of specs) {
    if (spec.defaultValue !== undefined && !spec.hidden) filters[spec.field] = spec.defaultValue;
  }
  const sort = resource.options.defaultSort;
  return { filters, ...(sort ? { sort: { field: String(sort.field), dir: sort.dir } } : {}) };
}

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
  // Match attacker-controlled `?pageSize=` to the offered bounded options.
  const pageSizeOptions = pageSizeChoices(configuredPageSize);
  const requestedPageSize = Number(searchParams.get("pageSize"));
  const pageSize = pageSizeOptions.includes(requestedPageSize)
    ? requestedPageSize
    : configuredPageSize;
  const softDelete = resource.options.delete?.softDelete;
  const listing = await listRequestFromParams(config, resource, reqCtx, searchParams);
  const { surface: readable, filterSpecs, filters, sort } = listing;
  const effectiveSearch = listing.search;
  const timeZone = resolveFormatting(config.formatting).timeZone;

  const displayPlural = pluralLabel(resource, name);
  const createAction = await buildResourceListCreateAction({ config, resource, name, reqCtx });
  const header = (
    <>
      <PageHeader title={displayPlural} {...(createAction ? { actions: createAction } : {})} />
      {/* Search sits in the filter row, not above it — one band of chrome. */}
      <div className="fp-mb-4 fp-flex fp-flex-wrap fp-items-center fp-gap-2">
        {readable.searchFields.length > 0 ? (
          <ResourceListSearch
            placeholder={
              config.labels?.table?.searchPlaceholder === undefined
                ? formatLabel(DEFAULT_LABELS.table.searchPlaceholder, {
                    label: labelInSentence(displayPlural),
                  })
                : formatLabel(config.labels.table.searchPlaceholder, { label: displayPlural })
            }
          />
        ) : null}
        <FilterSheet active={Object.keys(filters).length + (listing.query.includeDeleted ? 1 : 0)}>
          <div className="fp-flex-1">
            <ResourceListFilters filters={filterSpecs} />
          </div>
          {listing.deletedToggle ? <ResourceListDeletedToggle /> : null}
          <SavedViewsDropdown
            resource={name}
            staticViews={wireViews(resource, timeZone)}
            defaults={listDefaults(filterSpecs, resource)}
          />
        </FilterSheet>
      </div>
    </>
  );

  const listed = await readOrCard(
    {
      config,
      resource: name,
      operation: "list",
      label: displayPlural,
      ...(reqCtx.requestId ? { requestId: reqCtx.requestId } : {}),
    },
    () => listRows(config, resource, reqCtx, { ...listing.query, pageSize }),
  );
  if (listed.failed) {
    return (
      <ListNavigationProvider>
        {header}
        {listed.card}
      </ListNavigationProvider>
    );
  }
  const result = listed.value;
  const clientRows = result.rows;

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
      ? clientRows.flatMap((row, index) => {
          const id = rowIdentity(row, rowKey);
          return id !== null && result.operational[index]?.[String(softDelete)] != null ? [id] : [];
        })
      : undefined;

  const exportOptions = resource.options.export;
  const exportable =
    exportOptions && (await targetAllows(exportTarget(resource), reqCtx))
      ? {
          ...(exportOptions.formats ? { formats: exportOptions.formats } : {}),
          ...(exportOptions.fields ? { fields: exportOptions.fields.map(String) } : {}),
        }
      : undefined;
  const { rowActions, rowActionsById, bulkActions } = await resolveResourceListActions<Row>(
    resource,
    clientRows,
    rowKey,
    reqCtx,
    mergeLabels(config.labels),
    new Set(deletedRowKeys),
  );
  const createdRowKeyParam = searchParams.get("fp_created");
  const createdRowKey =
    createdRowKeyParam && createdRowKeyParam.length <= 512 ? createdRowKeyParam : undefined;

  return (
    <ListNavigationProvider>
      {header}
      <DataTableWithDrawerRows
        resource={name}
        columns={columns}
        rows={clientRows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        pageSizeOptions={pageSizeOptions}
        rowKey={rowKey as keyof Row & string}
        rowLabel={labelInSentence(singularLabel(resource, name))}
        {...(createdRowKey ? { enteringRowKeys: [createdRowKey], createdRowKey } : {})}
        {...(resource.options.density ? { density: resource.options.density } : {})}
        {...(exportable ? { exportable } : {})}
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
          creatable: createAction !== undefined,
        })}
      />
    </ListNavigationProvider>
  );
}
