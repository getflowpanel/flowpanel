import type {
  ColumnDef,
  RequestContext,
  ResolvedAdminConfig,
  TableWidget,
  TableWidgetOptions,
  WidgetColumn,
  WidgetContext,
} from "@flowpanel/core";
import { resolveFormatting } from "@flowpanel/core";
import { TableWidget as TableWidgetRenderer } from "@flowpanel/react";
import type { ReactNode } from "react";
import { filterHref } from "./dashboard-filters";
import { DEFAULT_RESOURCE_ROW_KEY } from "./defaults";
import { filteredEmptyState } from "./filtered-empty";
import { buildHref } from "./href";
import { type PrerenderedColumn, prerenderResourceCells } from "./prerender-cells";
import { realtimeProp } from "./realtime-channels";
import { withReferenceCells } from "./reference-cells";
import { readRelatedRows } from "./require-authorized";
import { resolveLink } from "./resolve-link";
import { rowIdentity, rowKeyOf } from "./row-identity";
import { tableFilters } from "./table-filters";
import { type CaptionPromise, NO_CAPTION } from "./widget-caption";

type WidgetRow = Record<string, unknown>;
type ColumnSpec = string | WidgetColumn;

function specField(spec: ColumnSpec): string {
  return typeof spec === "string" ? spec : spec.field;
}

/** Resource column defs, narrowed and reordered to an explicit widget column list. */
function pickWidgetColumns(
  declared: ReadonlyArray<string | ColumnDef<WidgetRow>>,
  wanted: string[] | undefined,
): ReadonlyArray<string | ColumnDef<WidgetRow>> {
  if (!wanted || wanted.length === 0) return declared;
  return wanted.map(
    (field) =>
      declared.find((c) => typeof c === "object" && c.field === field) ??
      declared.find((c) => c === field) ??
      field,
  );
}

/** A dashboard table has no sort handler and no inline-edit target — strip both affordances. */
function toWidgetColumn(c: PrerenderedColumn<WidgetRow>): PrerenderedColumn<WidgetRow> {
  const out: PrerenderedColumn<WidgetRow> = { field: c.field };
  if (c.label !== undefined) out.label = c.label;
  if (c.width !== undefined) out.width = c.width;
  if (c.align !== undefined) out.align = c.align;
  if (c.className !== undefined) out.className = c.className;
  if (c.type !== undefined) out.type = c.type;
  if (c.format !== undefined) out.format = c.format;
  if (c.content !== undefined) out.content = c.content;
  if (c.textRem !== undefined) out.textRem = c.textRem;
  return out;
}

/** What the config said about a column it named itself wins over the resource's own. */
function applySpecs(
  columns: PrerenderedColumn<WidgetRow>[],
  specs: ColumnSpec[] | undefined,
): PrerenderedColumn<WidgetRow>[] {
  const overrides = new Map<string, WidgetColumn>();
  for (const spec of specs ?? []) if (typeof spec !== "string") overrides.set(spec.field, spec);
  if (overrides.size === 0) return columns;
  return columns.map((c) => {
    const spec = overrides.get(c.field);
    if (!spec) return c;
    return {
      ...c,
      ...(spec.label !== undefined ? { label: spec.label } : {}),
      ...(spec.format !== undefined ? { format: spec.format } : {}),
      ...(spec.align !== undefined ? { align: spec.align } : {}),
      ...(spec.width !== undefined ? { width: spec.width } : {}),
    };
  });
}

function seeAllHref(
  config: ResolvedAdminConfig,
  options: TableWidgetOptions,
  ctx: WidgetContext,
): string | undefined {
  if (options.seeAll === true)
    return options.resource ? buildHref(config, options.resource) : undefined;
  if (options.seeAll === false || options.seeAll === undefined) return undefined;
  return resolveLink(config, ctx, options.seeAll);
}

/** Render a `table()` widget on the server. */
export async function renderTableWidget(
  widget: TableWidget,
  ctx: WidgetContext,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  caption: CaptionPromise = NO_CAPTION,
): Promise<ReactNode> {
  const options = widget.options;
  const specs = options.columns as ColumnSpec[] | undefined;
  const wanted = specs?.map(specField);
  const resource = options.resource ? config.resourcesByName.get(options.resource) : undefined;
  const rowKey = options.rowKey ?? (resource ? rowKeyOf(resource) : DEFAULT_RESOURCE_ROW_KEY);

  let rows: WidgetRow[] = [];
  let columns: PrerenderedColumn<WidgetRow>[] = [];
  let prerenderedCells: (ReactNode | undefined)[][] | undefined;

  if (options.query) {
    const produced = (await options.query(ctx)) as WidgetRow[];
    rows = options.limit === undefined ? produced : produced.slice(0, options.limit);
  } else if (resource) {
    const filters = tableFilters(options, ctx, config, resource);
    const related =
      filters === null
        ? []
        : await readRelatedRows(config, resource, reqCtx, {
            filters,
            dateRange: ctx.dateRange,
            pageSize: widget.options.limit ?? 10,
            extraFields: [...(wanted ?? []), rowKey],
          });
    rows = (related ?? []) as WidgetRow[];
    if (related) {
      const defs = pickWidgetColumns(
        resource.options.columns as ReadonlyArray<string | ColumnDef<WidgetRow>>,
        wanted,
      );
      const metaByField = new Map(
        config.adapter.introspect(resource.ref).columns.map((c) => [c.name, c]),
      );
      const prerendered = prerenderResourceCells<WidgetRow>(defs, rows, reqCtx, {
        dropHidden: !wanted || wanted.length === 0,
        metaByField,
        formatting: resolveFormatting(config.formatting),
      });
      columns = prerendered.columns.map(toWidgetColumn);
      prerenderedCells = await withReferenceCells<WidgetRow>(
        config,
        reqCtx,
        defs,
        rows,
        columns,
        prerendered.prerenderedCells,
      );
    }
  }

  if (columns.length === 0 && wanted && wanted.length > 0) {
    columns = wanted.map((field) => ({ field }));
  } else if (columns.length === 0 && rows[0]) {
    columns = Object.keys(rows[0]).map((field) => ({ field }));
  }
  columns = applySpecs(columns, specs);

  const filter = options.filterOnClick;
  const rowHref = options.rowHref;
  const hrefs = filter
    ? rows.map((row) => {
        const id = rowIdentity(row, rowKey);
        return id === null ? null : filterHref(ctx, filter, id);
      })
    : rowHref
      ? rows.map((row) =>
          rowIdentity(row, rowKey) === null
            ? null
            : (resolveLink(config, ctx, rowHref(row, ctx)) ?? null),
        )
      : undefined;
  const seeAll = seeAllHref(config, options, ctx);
  const captionLine = await caption;

  return (
    <TableWidgetRenderer
      {...(options.label ? { label: options.label } : {})}
      rows={rows}
      columns={columns}
      rowKey={rowKey}
      {...(prerenderedCells ? { prerenderedCells } : {})}
      {...realtimeProp(options.realtime)}
      emptyState={filteredEmptyState(ctx) ?? options.emptyState ?? ctx.labels.widget.empty}
      {...(hrefs ? { hrefs } : {})}
      {...(seeAll ? { seeAllHref: seeAll, seeAllLabel: ctx.labels.widget.seeAll } : {})}
      {...(captionLine ? { caption: captionLine } : {})}
      {...(options.density ? { density: options.density } : {})}
    />
  );
}
