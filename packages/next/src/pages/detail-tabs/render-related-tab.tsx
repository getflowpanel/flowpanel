import type {
  ColumnDef,
  DetailTab,
  RequestContext,
  ResolvedAdminConfig,
  ResourceName,
} from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { RelatedTabTable } from "@flowpanel/next/client";
import type { ReactNode } from "react";
import { DEFAULT_RESOURCE_ROW_KEY } from "../../runtime/defaults";
import { declaredFieldSet, parsePage } from "../../runtime/parse-list-params";
import { prerenderResourceCells } from "../../runtime/prerender-cells";
import { projectRowFields } from "../../runtime/project-row";
import { withReferenceCells } from "../../runtime/reference-cells";
import { readRelatedPage } from "../../runtime/require-authorized";
import { buildDetailTabContext } from "../../runtime/widget-context";

const RELATED_TAB_PAGE_SIZE = 25;
/** Each related tab paginates and sorts under its own URL keys. */
export const RELATED_PAGE_PREFIX = "relatedPage.";
export const RELATED_SORT_PREFIX = "relatedSort.";

type RelatedSort = { field: string; dir: "asc" | "desc" };

/** `<field>.<asc|desc>`, accepted only for a column the target really has. */
export function parseRelatedSort(
  raw: string | null,
  sortable: ReadonlySet<string>,
): RelatedSort | null {
  if (!raw) return null;
  const at = raw.lastIndexOf(".");
  if (at <= 0) return null;
  const field = raw.slice(0, at);
  const dir = raw.slice(at + 1);
  if (!sortable.has(field) || (dir !== "asc" && dir !== "desc")) return null;
  return { field, dir };
}

/**
 * The list page accepts `?f_<field>=<value>` only for a scalar value on a field it
 * declares. A link it would silently drop is worse than no link, so return null.
 */
export function openListFilter(
  filters: Record<string, unknown>,
  declared: ReadonlySet<string>,
): Record<string, unknown> | null {
  for (const [field, value] of Object.entries(filters)) {
    if (!declared.has(field)) return null;
    const kind = typeof value;
    if (kind !== "string" && kind !== "number" && kind !== "boolean" && kind !== "bigint") {
      return null;
    }
  }
  return filters;
}

function declaredFieldNames<Row>(
  defs: ReadonlyArray<keyof Row | ColumnDef<Row>> | undefined,
): string[] {
  return (defs ?? [])
    .map((c) => (typeof c === "object" ? String((c as ColumnDef<Row>).field ?? "") : String(c)))
    .filter((field) => field !== "");
}

export async function renderRelatedTab<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  row: Row,
  tab: DetailTab<Row>,
  req: Request,
  sp: URLSearchParams,
): Promise<ReactNode> {
  const labels = mergeLabels(config.labels);
  const resourceName = tab.resource as ResourceName;
  const target = config.resourcesByName.get(resourceName);
  if (!target) {
    return (
      <div className="text-fp-text-3">
        {labels.detail.unknownResource.replace("{resource}", String(resourceName))}
      </div>
    );
  }

  const intro = config.adapter.introspect(target.ref);
  const hidden = new Set(tab.hide ?? []);
  const targetCols = (
    target.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>> | undefined
  )?.filter((c) => !hidden.has(typeof c === "object" ? String(c.field ?? "") : String(c)));
  const introspected = new Set(intro.columns.map((c) => c.name));
  const sortable = new Set(
    declaredFieldNames<Row>(targetCols).filter((field) => introspected.has(field)),
  );

  const sortParam = `${RELATED_SORT_PREFIX}${tab.key}`;
  const pageParam = `${RELATED_PAGE_PREFIX}${tab.key}`;
  const urlSort = parseRelatedSort(sp.get(sortParam), sortable);
  // The fallback has to be a column the adapter will accept, so it is the
  // introspected primary key rather than the configured display key.
  const sort: RelatedSort = urlSort ??
    tab.sort ??
    (target.options.defaultSort as RelatedSort | undefined) ?? {
      field: intro.primaryKey,
      dir: "asc",
    };

  const filters = tab.filter ? tab.filter(row) : {};
  const read = (page: number) =>
    readRelatedPage(config, target, reqCtx, {
      filters,
      page,
      pageSize: RELATED_TAB_PAGE_SIZE,
      sort,
    });

  const requested = parsePage(sp.get(pageParam));
  let result = await read(requested);
  // A page past the end still has to lead back to the records that exist.
  if (result && result.rows.length === 0 && result.total > 0) {
    const last = Math.max(1, Math.ceil(result.total / result.pageSize));
    if (last !== requested) result = await read(last);
  }
  if (!result) {
    return <div className="px-2 py-6 text-sm text-fp-text-3">{labels.noResults}</div>;
  }

  const rows = result.rows as Row[];
  const metaByField = new Map(intro.columns.map((c) => [c.name, c]));
  const { columns, prerenderedCells } = prerenderResourceCells<Row>(
    targetCols ?? [],
    rows,
    reqCtx,
    {
      metaByField,
    },
  );
  for (const column of columns) column.sortable = sortable.has(column.field);
  const cells = await withReferenceCells<Row>(
    config,
    reqCtx,
    (targetCols ?? []) as ReadonlyArray<string | ColumnDef<Row>>,
    rows,
    columns,
    prerenderedCells,
  );
  const ctx = buildDetailTabContext(config, reqCtx, req, row);
  const openList = openListFilter(filters, declaredFieldSet(target.options));
  // A hidden column is hidden from the payload too, not just from the header.
  const visible = new Set<string>([
    ...columns.map((column) => column.field as string),
    (target.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY,
  ]);

  return (
    <RelatedTabTable<Row>
      pageParam={pageParam}
      sortParam={sortParam}
      sort={sort as { field: keyof Row & string; dir: "asc" | "desc" }}
      columns={columns}
      rows={rows.map((r) => projectRowFields(r, visible))}
      total={result.total}
      page={result.page}
      pageSize={result.pageSize}
      rowKey={
        ((target.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY) as keyof Row &
          string
      }
      {...(openList
        ? {
            openListHref: ctx.href(resourceName, undefined, { filter: openList }),
            openListLabel: labels.related.openList,
          }
        : {})}
      {...(cells ? { prerenderedCells: cells } : {})}
    />
  );
}
