import type {
  ActionEmphasis,
  DetailOptions,
  DetailTab,
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import {
  accessAllows,
  assertResourceScope,
  authorizeOperation,
  DEFAULT_LABELS,
  filterReadableProjection,
  resolveOperationAccess,
  runWithRequestContext,
} from "@flowpanel/core";
import { DashboardDateRange, DetailTabsClient } from "@flowpanel/next/client";
import { Button, PageHeader } from "@flowpanel/react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type * as React from "react";
import { DEFAULT_RESOURCE_ROW_KEY } from "../runtime/defaults";
import { buildHref } from "../runtime/href";
import {
  declaredDetailBaseFields,
  declaredDetailPolicyFields,
  projectRowFields,
  selectKnownFields,
} from "../runtime/project-row";
import { type QueryOutcome, type QuerySite, readOrCard } from "../runtime/query-error";
import { buildRequestContext } from "../runtime/request-setup";
import { scopeBinding } from "../runtime/scope-binding";
import { buildWidgetContext } from "../runtime/widget-context";
import { recordAside, recordLayout, recordStrip } from "./detail-page/detail-body";
import { headerBadges, recordHeader } from "./detail-page/detail-header";
import { recordRange } from "./detail-page/record-context";
import { renderFieldsTab } from "./detail-tabs/render-fields-tab";
import { detailFieldsForTab, renderDetailTabs } from "./detail-tabs/render-tab";

type Row = Record<string, unknown>;

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
  await authorizeOperation(resolveOperationAccess(resource.options.access, "read"), reqCtx);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope as "bypass" | ((...a: unknown[]) => unknown) | undefined,
  });

  const baseFields = declaredDetailBaseFields(resource);
  // Resolved once so policy callbacks cannot disagree between the base and optional second read.
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
  const searchParams = new URL(req.url).searchParams;
  const requestedTab = searchParams.get("tab");
  const initiallyActive = initialActiveTab(tabs ?? [], requestedTab);
  const initialFields = initiallyActive
    ? detailFieldsForTab(baseFields, initiallyActive)
    : baseFields;
  const readableInitialFields = [...initialFields].filter((field) => readable.has(field));

  const site: QuerySite = {
    config,
    resource: name,
    operation: "get",
    ...(reqCtx.requestId ? { requestId: reqCtx.requestId } : {}),
  };
  const first = await readDetailRow(config, resource, reqCtx, id, knownColumns, {
    fields: readableInitialFields,
    site,
  });
  if (first.failed) return first.card;
  const row = first.value;
  if (!row) notFound();

  const baseRow = projectRowFields(row, readableBaseFields);
  const visibleTabs = hasTabs ? (tabs ?? []).filter((tab) => !tab.hidden?.(baseRow)) : [];
  const active = hasTabs ? activeTab(visibleTabs, requestedTab) : undefined;
  const activeFields = active ? detailFieldsForTab(baseFields, active) : baseFields;
  const readableActiveFields = [...activeFields].filter((field) => readable.has(field));
  const initiallyReadable = new Set(readableInitialFields);
  const needsActiveRead = readableActiveFields.some((field) => !initiallyReadable.has(field));
  let activeRow: Row | null = projectRowFields(row, readableActiveFields);
  if (needsActiveRead) {
    const second = await readDetailRow(config, resource, reqCtx, id, knownColumns, {
      fields: readableActiveFields,
      site,
    });
    if (second.failed) return second.card;
    activeRow = second.value;
  }
  if (!activeRow) notFound();

  const detail = resource.options.detail as DetailOptions<Row> | undefined;
  const rowKey = (resource.options.rowKey as string | undefined) ?? DEFAULT_RESOURCE_ROW_KEY;
  const range = recordRange(config, detail, searchParams);
  const ctx = buildWidgetContext(config, reqCtx, req, range, activeRow, rowKey, name);
  const canEdit =
    !resource.options.update?.disabled &&
    (await accessAllows(resolveOperationAccess(resource.options.access, "update"), reqCtx));
  const [header, strip, aside, main] = await Promise.all([
    recordHeader(resource, name, baseRow, ctx, config),
    recordStrip(detail, ctx, config, reqCtx, name),
    recordAside(detail, ctx, config, reqCtx, name),
    hasTabs
      ? renderDetailTabs<Row>({
          config,
          reqCtx,
          resource,
          row: activeRow,
          req,
          searchParams,
          visible: visibleTabs,
          active,
          ctx,
        }).then((tabs) => <DetailTabsClient tabs={tabs} />)
      : renderFieldsTab<Row>(config, reqCtx, resource, baseRow, {
          ...(detail?.fields ? { fields: detail.fields as DetailTab<Row>["fields"] } : {}),
        }),
  ]);
  const picker = detail?.dateRange ? (
    <DashboardDateRange
      {...(range.preset === "custom"
        ? { from: range.from.toISOString(), to: range.to.toISOString() }
        : { preset: range.preset })}
      {...(detail.dateRange.presets ? { presets: detail.dateRange.presets } : {})}
    />
  ) : null;
  const actions =
    picker || canEdit ? (
      <>
        {picker}
        {canEdit ? editAction(config, name, id, resource.options.update?.emphasis) : null}
      </>
    ) : null;

  return (
    <>
      <PageHeader
        title={header.title}
        {...(header.subtitle ? { description: header.subtitle } : {})}
        {...headerBadges(header.badges)}
        {...(actions ? { actions } : {})}
      />
      {recordLayout(strip, main, aside)}
    </>
  );
}

function editAction(
  config: ResolvedAdminConfig,
  name: string,
  id: string,
  emphasis: ActionEmphasis | undefined,
): React.ReactNode {
  return (
    <Button asChild variant={emphasis === "primary" ? "default" : "outline"}>
      <Link href={buildHref(config, name, id, "edit")}>
        {config.labels?.actions?.edit ?? DEFAULT_LABELS.actions.edit}
      </Link>
    </Button>
  );
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
  { fields, site }: { fields: Iterable<string>; site: QuerySite },
): Promise<QueryOutcome<Row | null>> {
  const ctx: ItemQueryContext = {
    ...reqCtx,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams: new URLSearchParams(),
    signal: new AbortController().signal,
    id,
    select: selectKnownFields(fields, knownColumns),
    ...scopeBinding(resource, reqCtx),
  };
  const got = await readOrCard(site, async () =>
    runWithRequestContext(reqCtx, () => config.adapter.get(resource.ref, ctx)),
  );
  if (got.failed) return got;
  const row = got.value as Row | null;
  return { failed: false, value: row ? projectRowFields(row, fields) : null };
}
