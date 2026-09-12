import type {
  ColumnDef,
  ColumnFormat,
  DetailTab,
  FieldDef,
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedFormatting,
  ResourceConfig,
} from "@flowpanel/core";
import {
  accessAllows,
  assertResourceScope,
  authorizeOperation,
  checkRequireRole,
  DEFAULT_LABELS,
  filterReadableProjection,
  mergeLabels,
  resolveFieldLabel,
  resolveFormatting,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { DetailTabsClient, RelatedTabTable } from "@flowpanel/next/client";
import { Button, KV, KVRow, PageHeader } from "@flowpanel/react";
import Link from "next/link";
import type * as React from "react";
import { DEFAULT_RESOURCE_ROW_KEY } from "../runtime/defaults";
import { formatFieldValue } from "../runtime/format-field-value";
import { buildHref } from "../runtime/href";
import { parsePage } from "../runtime/parse-list-params";
import { prerenderResourceCells } from "../runtime/prerender-cells";
import {
  declaredDetailBaseFields,
  declaredDetailPolicyFields,
  projectRowFields,
  selectKnownFields,
} from "../runtime/project-row";
import { renderColumnFormat } from "../runtime/render-column-format";
import { buildRequestContext } from "../runtime/request-setup";
import { readRelatedPage } from "../runtime/require-authorized";
import { singularLabel } from "../runtime/resource-title";
import { scopeBinding } from "../runtime/scope-binding";
import { NotFound } from "./not-found";

const RELATED_TAB_PAGE_SIZE = 25;
/** Each related tab paginates under its own URL key. */
const RELATED_PAGE_PREFIX = "relatedPage.";
type Row = Record<string, unknown>;

interface DetailCell {
  label?: string;
  format?: ColumnFormat;
  node?: React.ReactNode;
}

/** Field → the list page's own label / render / format for that column. */
function buildDetailCells<Row extends Record<string, unknown>>(
  resource: ResourceConfig,
  row: Row,
  reqCtx: RequestContext,
): Map<string, DetailCell> {
  const out = new Map<string, DetailCell>();
  const defs = resource.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>> | undefined;
  if (!defs || defs.length === 0) return out;
  const { columns, prerenderedCells } = prerenderResourceCells<Row>(defs, [row], reqCtx);
  columns.forEach((c, i) => {
    const cell: DetailCell = {};
    if (c.label !== undefined) cell.label = c.label;
    if (c.format !== undefined) cell.format = c.format;
    const node = prerenderedCells?.[0]?.[i];
    if (node !== undefined) cell.node = node;
    out.set(c.field as string, cell);
  });
  return out;
}

function detailValue(
  value: unknown,
  cell: DetailCell | undefined,
  formatting: ResolvedFormatting,
): React.ReactNode {
  if (cell?.node !== undefined) return cell.node;
  if (cell?.format !== undefined) return renderColumnFormat(cell.format, value, formatting);
  return formatFieldValue(value);
}

export interface ResourceDetailPageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  id: string;
  req: Request;
  reqCtx?: RequestContext;
}

export async function ResourceDetailPage({
  config,
  resource,
  name,
  id,
  req,
  reqCtx: providedReqCtx,
}: ResourceDetailPageProps) {
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

  const baseFields = declaredDetailBaseFields(resource);
  // Resolve every declared detail field once before adapter work. The query only
  // receives the visible tab's fields, but policy callbacks cannot disagree
  // between the base and optional second read.
  const readable = new Set(
    await filterReadableProjection(
      [...declaredDetailPolicyFields(resource)],
      resource.options.fieldAccess,
      reqCtx,
    ),
  );
  const readableBaseFields = [...baseFields].filter((field) => readable.has(field));
  const knownColumns = config.adapter.introspect(resource.ref).columns;
  const tabs = resource.options.detail?.tabs as DetailTab<Row>[] | undefined;
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;
  const requestedTab = new URL(req.url).searchParams.get("tab");
  const initiallyActive = initialActiveTab(tabs ?? [], requestedTab);
  const initialFields = initiallyActive
    ? detailFieldsForTab(baseFields, initiallyActive)
    : baseFields;
  const readableInitialFields = [...initialFields].filter((field) => readable.has(field));
  const ctx: ItemQueryContext = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id,
    select: selectKnownFields(readableInitialFields, knownColumns),
    ...scopeBinding(config, resource, reqCtx),
  };

  const row = (await runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, ctx),
  )) as Record<string, unknown> | null;

  if (!row) return <NotFound config={config} />;

  const baseRow = projectRowFields(row, readableBaseFields);
  const visibleTabs = hasTabs ? (tabs ?? []).filter((tab) => !tab.hidden?.(baseRow)) : [];
  const active = hasTabs ? activeTab(visibleTabs, requestedTab) : undefined;
  const activeFields = active ? detailFieldsForTab(baseFields, active) : baseFields;
  const readableActiveFields = [...activeFields].filter((field) => readable.has(field));
  const initiallyReadable = new Set(readableInitialFields);
  const needsActiveRead = readableActiveFields.some((field) => !initiallyReadable.has(field));
  const activeRow = needsActiveRead
    ? await readDetailRow(config, resource, reqCtx, id, knownColumns, readableActiveFields)
    : projectRowFields(row, readableActiveFields);
  if (!activeRow) return <NotFound config={config} />;

  const pk = (resource.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY;
  const label = singularLabel(resource, name);
  const fallbackTitle = baseRow[pk] === undefined ? label : `${label} · ${String(baseRow[pk])}`;
  const title = (await resource.options.detail?.header?.(baseRow)) ?? fallbackTitle;
  const canEdit =
    !resource.options.update?.disabled &&
    (await accessAllows(
      resolveOperationAccess(resource.options.access, resource.options.requireRole, "update"),
      reqCtx,
    ));

  const editAction = (
    <Button asChild>
      <Link href={buildHref(config, name, id, "edit")}>
        {config.labels?.actions?.edit ?? DEFAULT_LABELS.actions.edit}
      </Link>
    </Button>
  );

  const cells = hasTabs ? null : buildDetailCells(resource, baseRow, reqCtx);
  const formatting = resolveFormatting(config.formatting);

  return (
    <>
      {!canEdit ? <PageHeader title={title} /> : <PageHeader title={title} actions={editAction} />}
      {hasTabs ? (
        <DetailTabsClient
          tabs={
            await renderTabs(
              config,
              reqCtx,
              resource,
              activeRow,
              visibleTabs,
              active,
              new URL(req.url).searchParams,
            )
          }
        />
      ) : (
        <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
          <KV>
            {Object.entries(baseRow).map(([k, v]) => (
              <KVRow
                key={k}
                label={resolveFieldLabel(cells?.get(k)?.label, k)}
                value={detailValue(v, cells?.get(k), formatting)}
              />
            ))}
          </KV>
        </div>
      )}
    </>
  );
}

/** Build a tab's explicitly declared field dependencies without interpreting `*` as a DB wildcard. */
function detailFieldsForTab<Row>(baseFields: Set<string>, tab: DetailTab<Row>): Set<string> {
  const fields = new Set(baseFields);
  if (!Array.isArray(tab.fields)) return fields;
  for (const entry of tab.fields) {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "symbol") {
      fields.add(String(entry));
    } else if (entry && typeof entry === "object" && typeof entry.name === "string") {
      fields.add(entry.name);
    }
  }
  return fields;
}

function activeTab<Row>(
  tabs: DetailTab<Row>[],
  requestedTab: string | null,
): DetailTab<Row> | undefined {
  return tabs.find((tab) => tab.key === requestedTab) ?? tabs[0];
}

/** Return an active tab only when its identity is known before hidden predicates run. */
function initialActiveTab<Row>(
  tabs: DetailTab<Row>[],
  requestedTab: string | null,
): DetailTab<Row> | undefined {
  const requested = tabs.find((tab) => tab.key === requestedTab);
  if (requested) return requested.hidden ? undefined : requested;
  return tabs[0]?.hidden ? undefined : tabs[0];
}

async function readDetailRow(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
  id: string,
  knownColumns: ReadonlyArray<{ name: string }>,
  readableFields: Iterable<string>,
): Promise<Record<string, unknown> | null> {
  const ctx: ItemQueryContext = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id,
    select: selectKnownFields(readableFields, knownColumns),
    ...scopeBinding(config, resource, reqCtx),
  };
  const row = (await runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, ctx),
  )) as Record<string, unknown> | null;
  return row ? projectRowFields(row, readableFields) : null;
}

/** Keep the tab list, but execute only the selected visible tab on the server. */
async function renderTabs<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: Awaited<ReturnType<typeof buildRequestContext>>,
  resource: ResourceConfig,
  activeRow: Row,
  visible: DetailTab<Row>[],
  active: DetailTab<Row> | undefined,
  sp: URLSearchParams,
): Promise<Array<{ key: string; label: string; content: React.ReactNode }>> {
  const out: Array<{ key: string; label: string; content: React.ReactNode }> = [];
  for (const tab of visible) {
    out.push({
      key: tab.key,
      label: tab.label,
      content:
        tab === active ? await renderTab(config, reqCtx, resource, activeRow, tab, sp) : null,
    });
  }
  return out;
}

async function renderTab<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: Awaited<ReturnType<typeof buildRequestContext>>,
  resource: ResourceConfig,
  row: Row,
  tab: DetailTab<Row>,
  sp: URLSearchParams,
): Promise<React.ReactNode> {
  if (tab.render) return tab.render(row);

  if (tab.resource) {
    const target = config.resourcesByName.get(tab.resource);
    if (!target) {
      // A configuration mistake, not a reader-facing state: name it plainly.
      return <div className="text-fp-text-3">Unknown resource: {tab.resource}</div>;
    }
    const pageParam = `${RELATED_PAGE_PREFIX}${tab.key}`;
    const intro = config.adapter.introspect(target.ref);
    const rowKey = (target.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY;
    // The fallback has to be a column the adapter will accept, so it is the
    // introspected primary key rather than the configured display key.
    const sort = (target.options.defaultSort as
      | { field: string; dir: "asc" | "desc" }
      | undefined) ?? { field: intro.primaryKey, dir: "asc" };
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
    const labels = mergeLabels(config.labels);
    if (!result) {
      return <div className="px-2 py-6 text-sm text-fp-text-3">{labels.noResults}</div>;
    }
    const rows = result.rows as Row[];
    const targetCols = target.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>>;
    const metaByField = new Map(intro.columns.map((c) => [c.name, c]));
    const { columns, prerenderedCells } = prerenderResourceCells<Row>(targetCols, rows, reqCtx, {
      defaultSortable: false,
      metaByField,
    });
    return (
      <RelatedTabTable<Row>
        pageParam={pageParam}
        columns={columns}
        rows={rows}
        total={result.total}
        page={result.page}
        pageSize={result.pageSize}
        rowKey={rowKey as keyof Row & string}
        {...(prerenderedCells ? { prerenderedCells } : {})}
      />
    );
  }

  const selected = tab.fields;
  const fieldList = selectFields(row, selected);
  const cells = buildDetailCells(resource, row, reqCtx);
  const formatting = resolveFormatting(config.formatting);
  return (
    <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
      <KV>
        {fieldList.map(({ name, label }) => (
          <KVRow
            key={name}
            label={resolveFieldLabel(label ?? cells.get(name)?.label, name)}
            value={detailValue(row[name as keyof Row], cells.get(name), formatting)}
          />
        ))}
      </KV>
    </div>
  );
}

function selectFields<Row extends Record<string, unknown>>(
  row: Row,
  fields: DetailTab<Row>["fields"],
): Array<{ name: string; label?: string }> {
  if (fields === undefined || fields === "*") {
    return Object.keys(row).map((k) => ({ name: k }));
  }
  return fields.map((f) => {
    if (typeof f === "string" || typeof f === "number" || typeof f === "symbol") {
      return { name: String(f) };
    }
    const def = f as FieldDef<Row>;
    return def.label !== undefined
      ? { name: String(def.name), label: def.label }
      : { name: String(def.name) };
  });
}
