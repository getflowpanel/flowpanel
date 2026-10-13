import type {
  FilterDef,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import { type ListRowsQuery, mayListDeleted } from "./list-rows";
import {
  parseListParams,
  type ResolvedFilterSpec,
  resolveFilterSpecs,
  sanitizeFilterValues,
  withFilterDefaults,
} from "./parse-list-params";
import { type ReadableListSurface, resolveReadableListSurface } from "./readable-list";

type Row = Record<string, unknown>;

/** A list page's URL, read the one way the page and its export both use. */
export interface ListRequest {
  surface: ReadableListSurface;
  filterSpecs: ResolvedFilterSpec[];
  filters: Record<string, unknown>;
  /** The search that applies: empty when no search field is readable. */
  search: string;
  sort: { field: string; dir: "asc" | "desc" } | null;
  /** The resource soft-deletes and this caller may see deleted rows (they could restore one). */
  deletedToggle: boolean;
  /** `listRows`'s query for this URL; the caller adds `pageSize`. */
  query: ListRowsQuery;
}

/** `?q=`, `?sort=`, `?page=`, `?f_<field>=` and `?deleted=1`, limited to what the caller may read. */
export async function listRequestFromParams(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
  searchParams: URLSearchParams,
): Promise<ListRequest> {
  const softDelete = resource.options.delete?.softDelete;
  const surface = await resolveReadableListSurface(
    resource,
    reqCtx,
    searchParams,
    softDelete ? [String(softDelete)] : [],
  );
  const parsed = parseListParams(searchParams, surface.defaultSort, surface.fields);
  const timeZone = resolveFormatting(config.formatting).timeZone;
  const filterSpecs = await resolveFilterSpecs(
    surface.filters as Array<keyof Row | FilterDef<Row>>,
    reqCtx,
    timeZone,
    searchParams,
  );
  const filters = sanitizeFilterValues(
    withFilterDefaults(parsed.filters, filterSpecs),
    filterSpecs,
    timeZone,
  );
  const search = surface.searchFields.length > 0 ? parsed.search : "";
  const deletedToggle = !!softDelete && (await mayListDeleted(resource, reqCtx));
  const includeDeleted = deletedToggle && searchParams.get("deleted") === "1";
  return {
    surface,
    filterSpecs,
    filters,
    search,
    sort: parsed.sort,
    deletedToggle,
    query: {
      filters,
      search,
      sort: parsed.sort,
      page: parsed.page,
      fields: surface.rowFields,
      operationalFields: surface.operationalFields,
      includeDeleted,
      searchParams: surface.searchParams,
      readable: new Set([...surface.fields, ...surface.rowFields, ...surface.operationalFields]),
    },
  };
}
