import type {
  ColumnDef,
  DetailTab,
  FieldDef,
  ItemQueryContext,
  ListQueryContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { assertResourceScope, checkRequireRole, runWithRequestContext } from "@flowpanel/core";
import { DetailTabsClient } from "@flowpanel/next/client";
import { Button, DataTable, KV, KVRow, PageHeader } from "@flowpanel/react";
import type * as React from "react";
import { formatFieldValue } from "../runtime/format-field-value.js";
import { buildHref } from "../runtime/href.js";
import { prerenderResourceCells } from "../runtime/prerender-cells.js";
import { projectRow } from "../runtime/project-row.js";
import { buildRequestContext } from "../runtime/request-setup.js";
import { scopeBinding } from "../runtime/scope-binding.js";
import { NotFound } from "./not-found.js";

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
              <KVRow key={k} label={k} value={formatFieldValue(v)} />
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
  _resource: ResourceConfig,
  row: Row,
  tab: DetailTab<Row>,
): Promise<React.ReactNode> {
  if (tab.render) return tab.render(row);

  if (tab.resource) {
    const target = config.resourcesByName.get(tab.resource);
    if (!target) {
      return <div className="text-fp-text-3">Unknown resource: {tab.resource}</div>;
    }
    checkRequireRole(target.options.requireRole, reqCtx.role, reqCtx.session);
    const filterValues = tab.filter ? tab.filter(row) : {};
    const listCtx: ListQueryContext<unknown> = {
      ...reqCtx,
      db: config.adapter.db,
      dateRange: { from: new Date(0), to: new Date() },
      searchParams: new URLSearchParams(),
      signal: new AbortController().signal,
      filters: filterValues,
      sort: null,
      page: 1,
      pageSize: 25,
      search: "",
      ...scopeBinding(config, target, reqCtx),
    };
    const list = await runWithRequestContext(reqCtx, () =>
      config.adapter.list(target.ref, listCtx),
    );
    const targetCols = target.options.columns as ReadonlyArray<keyof Row | ColumnDef<Row>>;
    const intro = config.adapter.introspect(target.ref);
    const metaByField = new Map(intro.columns.map((c) => [c.name, c]));
    const { columns, prerenderedCells } = prerenderResourceCells<Row>(
      targetCols,
      list.rows as Row[],
      reqCtx,
      { defaultSortable: false, metaByField },
    );
    if (list.rows.length === 0) {
      return <div className="px-2 py-6 text-sm text-fp-text-3">No related rows</div>;
    }
    const rowKey = (target.options.rowKey as string | undefined) ?? "id";
    const clientRows = (list.rows as Row[]).map((r) => projectRow(target, r));
    return (
      <DataTable
        columns={columns}
        rows={clientRows}
        total={list.total}
        page={list.page}
        pageSize={list.pageSize}
        rowKey={rowKey as keyof Row & string}
        {...(prerenderedCells ? { prerenderedCells } : {})}
        emptyTitle="No related rows"
      />
    );
  }

  const selected = tab.fields;
  const fieldList = selectFields(row, selected);
  return (
    <div className="rounded-fp border border-fp-border-1 bg-fp-bg-1 p-6">
      <KV>
        {fieldList.map(({ name, label }) => (
          <KVRow key={name} label={label} value={formatFieldValue(row[name as keyof Row])} />
        ))}
      </KV>
    </div>
  );
}

function selectFields<Row extends Record<string, unknown>>(
  row: Row,
  fields: DetailTab<Row>["fields"],
): Array<{ name: string; label: string }> {
  if (fields === undefined || fields === "*") {
    return Object.keys(row).map((k) => ({ name: k, label: k }));
  }
  return fields.map((f) => {
    if (typeof f === "string" || typeof f === "number" || typeof f === "symbol") {
      return { name: String(f), label: String(f) };
    }
    const def = f as FieldDef<Row>;
    return { name: String(def.name), label: def.label ?? String(def.name) };
  });
}
