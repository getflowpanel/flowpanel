import type {
  ColumnDef,
  ColumnFormat,
  DetailTab,
  FieldDef,
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  assertResourceScope,
  checkRequireRole,
  resolveFieldLabel,
  runWithRequestContext,
} from "@flowpanel/core";
import { DetailTabsClient } from "@flowpanel/next/client";
import { Button, DataTable, KV, KVRow, PageHeader } from "@flowpanel/react";
import type * as React from "react";
import { formatFieldValue } from "../runtime/format-field-value.js";
import { buildHref } from "../runtime/href.js";
import { prerenderResourceCells } from "../runtime/prerender-cells.js";
import { projectRow } from "../runtime/project-row.js";
import { renderColumnFormat } from "../runtime/render-column-format.js";
import { buildRequestContext } from "../runtime/request-setup.js";
import { readRelatedRows } from "../runtime/require-authorized.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import { NotFound } from "./not-found.js";

const RELATED_TAB_PAGE_SIZE = 25;

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

function detailValue(value: unknown, cell: DetailCell | undefined): React.ReactNode {
  if (cell?.node !== undefined) return cell.node;
  if (cell?.format !== undefined) return renderColumnFormat(cell.format, value);
  return formatFieldValue(value);
}

export interface ResourceDetailPageProps {
  config: ResolvedAdminConfig;
  resource: ResourceConfig;
  name: string;
  id: string;
  req: Request;
}

export async function ResourceDetailPage({
  config,
  resource,
  name,
  id,
  req,
}: ResourceDetailPageProps) {
  const reqCtx = await buildRequestContext({ req, config });
  checkRequireRole(resource.options.requireRole, reqCtx.role, reqCtx.session);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });

  const ctx: ItemQueryContext = {
    ...reqCtx,
    db: config.adapter.db,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id,
    ...scopeBinding(config, resource, reqCtx),
  };

  const row = (await runWithRequestContext(reqCtx, () =>
    config.adapter.get(resource.ref, ctx),
  )) as Record<string, unknown> | null;

  if (!row) return <NotFound config={config} />;

  const pk = (resource.options.rowKey as string | undefined) ?? "id";
  const title = `${resource.options.label ?? name} · ${String(row[pk])}`;

  const editAction = (
    <Button asChild>
      <a href={buildHref(config, name, id, "edit")}>Edit</a>
    </Button>
  );

  const tabs = resource.options.detail?.tabs;
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;
  const cells = hasTabs ? null : buildDetailCells(resource, row, reqCtx);

  return (
    <>
      {resource.options.update?.disabled ? (
        <PageHeader title={title} />
      ) : (
        <PageHeader title={title} actions={editAction} />
      )}
      {hasTabs ? (
        <DetailTabsClient
          tabs={await renderTabs(config, reqCtx, resource, row, tabs as DetailTab<typeof row>[])}
        />
      ) : (
        <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
          <KV>
            {Object.entries(projectRow(resource, row)).map(([k, v]) => (
              <KVRow
                key={k}
                label={resolveFieldLabel(cells?.get(k)?.label, k)}
                value={detailValue(v, cells?.get(k))}
              />
            ))}
          </KV>
        </div>
      )}
    </>
  );
}

/** Server-prerender each `DetailTab` into a React node. */
async function renderTabs<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: Awaited<ReturnType<typeof buildRequestContext>>,
  resource: ResourceConfig,
  row: Row,
  tabs: DetailTab<Row>[],
): Promise<Array<{ key: string; label: string; content: React.ReactNode }>> {
  const out: Array<{ key: string; label: string; content: React.ReactNode }> = [];
  for (const tab of tabs) {
    if (tab.hidden?.(row)) continue;
    out.push({
      key: tab.key,
      label: tab.label,
      content: await renderTab(config, reqCtx, resource, row, tab),
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
): Promise<React.ReactNode> {
  if (tab.render) return tab.render(row);

  if (tab.resource) {
    const target = config.resourcesByName.get(tab.resource);
    if (!target) {
      return <div className="text-fp-text-3">Unknown resource: {tab.resource}</div>;
    }
    const rows = (await readRelatedRows(config, target, reqCtx, {
      filters: tab.filter ? tab.filter(row) : {},
      pageSize: RELATED_TAB_PAGE_SIZE,
    })) as Row[] | null;
    if (!rows || rows.length === 0) {
      return <div className="px-2 py-6 text-sm text-fp-text-3">No related rows</div>;
    }
    const targetCols = target.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>>;
    const intro = config.adapter.introspect(target.ref);
    const metaByField = new Map(intro.columns.map((c) => [c.name, c]));
    const { columns, prerenderedCells } = prerenderResourceCells<Row>(targetCols, rows, reqCtx, {
      defaultSortable: false,
      metaByField,
    });
    const rowKey = (target.options.rowKey as string | undefined) ?? "id";
    return (
      <DataTable
        columns={columns}
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={RELATED_TAB_PAGE_SIZE}
        rowKey={rowKey as keyof Row & string}
        {...(prerenderedCells ? { prerenderedCells } : {})}
        emptyTitle="No related rows"
      />
    );
  }

  const selected = tab.fields;
  const projectedRow = selected === undefined || selected === "*" ? projectRow(resource, row) : row;
  const fieldList = selectFields(projectedRow, selected);
  const cells = buildDetailCells(resource, row, reqCtx);
  return (
    <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
      <KV>
        {fieldList.map(({ name, label }) => (
          <KVRow
            key={name}
            label={resolveFieldLabel(label ?? cells.get(name)?.label, name)}
            value={detailValue(projectedRow[name as keyof Row], cells.get(name))}
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
