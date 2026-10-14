import type {
  ColumnDef,
  ColumnFormat,
  DrawerConfig,
  DrawerTab,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
  WidgetContext,
} from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { isColumnDef } from "../runtime/column-defs";
import { buildHref } from "../runtime/href";
import { projectRowFields } from "../runtime/project-row";
import { filterColumnsByReadableFields, resolveReadableColumns } from "../runtime/readable-fields";
import { type RecordActions, recordActions } from "../runtime/record-actions";
import { readRelatedRows } from "../runtime/require-authorized";
import { singularLabel, singularTitle } from "../runtime/resource-title";
import { rowKeyOf } from "../runtime/row-identity";
import { visibleWidgets } from "../runtime/widget-access";
import { buildWidgetContext } from "../runtime/widget-context";
import type { SerializedDrawerAction } from "./drawer-action";
import { prerenderDrawerCells } from "./prerender";
import { fieldRenders, type SerializedFieldList, serializeFields } from "./serialize-fields";
import { type SerializedWidget, serializeWidget } from "./serialize-widget";

export type { SerializedDrawerAction, SerializedFieldList, SerializedWidget };

export type SerializedDrawerTab =
  | { kind: "fields"; key: string; label: string; fields: SerializedFieldList }
  | {
      kind: "resource";
      key: string;
      label: string;
      resource: string;
      rows: Record<string, unknown>[];
      columns: string[];
    }
  | {
      kind: "widgets";
      key: string;
      label: string;
      widgets: SerializedWidget[];
    };

export interface DrawerPayload extends Omit<RecordActions, "drawerActions"> {
  row: Record<string, unknown>;
  title: string;
  /** The line under the title, from `drawer.subtitle`. */
  subtitle?: string;
  /** The resource's display label, so the drawer never shows the raw registry name. */
  resourceLabel: string;
  width: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  fields: SerializedFieldList;
  tabs: SerializedDrawerTab[] | null;
  actions: SerializedDrawerAction[];
  /** Field → HTML for fields whose column declares a `render`. */
  prerendered: Record<string, string>;
  /** Field → column label, so drawer rows read like their table headers. */
  labels: Record<string, string>;
  /** Field → column `format`. Plain data, rendered client-side exactly as the table does. */
  formats: Record<string, ColumnFormat>;
  /** The record's own page, when the resource configures `detail`. */
  detailHref: string | null;
  /** Soft-deleted, shown only to a caller who could restore it. */
  deleted: boolean;
  /** The notice over a deleted row: "This customer was deleted". */
  deletedTitle?: string;
  /** A deleted row whose resource takes updates, so Restore can bring it back. */
  restorable: boolean;
}

/** Map of field → column `format`, so drawer rows format like their table cells. */
function buildFieldFormats(columns: ReadonlyArray<unknown>): Record<string, ColumnFormat> {
  const out: Record<string, ColumnFormat> = {};
  for (const col of columns.filter(isColumnDef)) {
    if (col.field && col.format !== undefined) out[col.field] = col.format;
  }
  return out;
}

/** Map of field → column `label`, for fields whose column sets one. */
function buildFieldLabels(columns: ReadonlyArray<unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columns.filter(isColumnDef)) {
    if (col.field && col.label) out[col.field] = col.label;
  }
  return out;
}

async function serializeTab(
  tab: DrawerTab,
  row: Record<string, unknown>,
  readableSourceFields: ReadonlySet<string>,
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  req: Request,
  rowKey: string,
  resource: string,
): Promise<SerializedDrawerTab> {
  if ("fields" in tab) {
    return {
      kind: "fields",
      key: tab.key,
      label: tab.label,
      fields: serializeFields(tab.fields, readableSourceFields),
    };
  }
  if ("widgets" in tab) {
    const widgetCtx: WidgetContext = buildWidgetContext(
      config,
      reqCtx,
      req,
      { from: new Date(0), to: new Date(), preset: "custom" },
      row,
      rowKey,
      resource,
    );
    const widgets: SerializedWidget[] = [];
    for (const w of await visibleWidgets(tab.widgets, reqCtx)) {
      widgets.push(await serializeWidget(w, config, reqCtx, widgetCtx));
    }
    return { kind: "widgets", key: tab.key, label: tab.label, widgets };
  }
  const target = config.resourcesByName.get(tab.resource);
  const rows = target
    ? await readRelatedRows(config, target, reqCtx, {
        filters: typeof tab.filter === "function" ? tab.filter(row) : {},
        pageSize: 20,
      })
    : null;
  if (!target || !rows) {
    return {
      kind: "resource",
      key: tab.key,
      label: tab.label,
      resource: tab.resource,
      rows: [],
      columns: [],
    };
  }
  const readableColumns = await resolveReadableColumns(
    target.options.columns as never[],
    target.options.fieldAccess,
    reqCtx,
  );
  const columns = readableColumns.map((c) => {
    if (typeof c === "string") return c;
    const col = c as { field?: string };
    return String(col.field ?? "");
  });
  return {
    kind: "resource",
    key: tab.key,
    label: tab.label,
    resource: tab.resource,
    rows,
    columns: columns.filter((c) => c),
  };
}

export interface DrawerPayloadArgs {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  drawer: DrawerConfig;
  name: string;
  id: string;
  row: Record<string, unknown>;
  readable: ReadonlySet<string>;
  reqCtx: RequestContext;
  req: Request;
  deleted?: boolean;
}

/** Everything the drawer shows for one row, built from fields the caller may read. */
export async function buildDrawerPayload({
  config,
  resource,
  drawer,
  name,
  id,
  row,
  readable,
  reqCtx,
  req,
  deleted = false,
}: DrawerPayloadArgs): Promise<DrawerPayload> {
  const projectedRow = projectRowFields(row, readable);
  const rowKey = rowKeyOf(resource);
  const title =
    typeof drawer.title === "function"
      ? String(drawer.title(projectedRow) ?? "")
      : String(projectedRow[rowKey] ?? "");

  const tabs: SerializedDrawerTab[] | null = drawer.tabs
    ? await Promise.all(
        drawer.tabs.map((t) =>
          serializeTab(t, projectedRow, readable, config, reqCtx, req, rowKey, name),
        ),
      )
    : null;

  const { drawerActions, ...menu } = await recordActions(
    config,
    resource,
    name,
    id,
    projectedRow,
    reqCtx,
    deleted,
  );
  const columns = filterColumnsByReadableFields(
    (resource.options.columns as ReadonlyArray<
      keyof Record<string, unknown> | ColumnDef<Record<string, unknown>>
    >) ?? [],
    readable,
  );
  return {
    row: projectedRow,
    title,
    ...(drawer.subtitle ? { subtitle: String(drawer.subtitle(projectedRow) ?? "") } : {}),
    resourceLabel: singularLabel(resource, name),
    width: drawer.width ?? "lg",
    fields: serializeFields(drawer.fields ?? "*", readable),
    tabs,
    actions: drawerActions,
    prerendered: await prerenderDrawerCells(
      columns,
      fieldRenders(
        [drawer.fields, ...(drawer.tabs ?? []).map((t) => ("fields" in t ? t.fields : undefined))],
        readable,
      ),
      projectedRow,
      reqCtx,
    ),
    labels: buildFieldLabels(columns),
    formats: buildFieldFormats(columns),
    detailHref: resource.options.detail ? buildHref(config, name, id) : null,
    deleted,
    ...(deleted
      ? { deletedTitle: singularTitle(mergeLabels(config.labels).detail.deleted, resource, name) }
      : {}),
    restorable: deleted && !resource.options.update?.disabled,
    ...menu,
  };
}
