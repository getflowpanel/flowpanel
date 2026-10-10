import type {
  DetailOptions,
  DetailTab,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { assertResourceScope, mergeLabels, resolveOperationAccess } from "@flowpanel/core";
import {
  DashboardDateRange,
  DetailTabsClient,
  RecordActionsBar,
  RestoreButton,
} from "@flowpanel/next/client";
import { HealthBanner, PageHeader } from "@flowpanel/react";
import { notFound } from "next/navigation";
import type * as React from "react";
import { AUDIT_HISTORY_TAB } from "../runtime/audit-view";
import { rowVisibility, withSoftDeleteColumn } from "../runtime/deleted-row";
import { detailFieldsForTab, detailReadPlan } from "../runtime/detail-read-plan";
import { projectRowFields, selectKnownFields } from "../runtime/project-row";
import { type QueryOutcome, type QuerySite, readOrCard } from "../runtime/query-error";
import { recordActions } from "../runtime/record-actions";
import { readRecord } from "../runtime/record-read";
import { buildRequestContext } from "../runtime/request-setup";
import { requireAccessIfSet } from "../runtime/require-access";
import { singularLabel, singularTitle } from "../runtime/resource-title";
import { rowKeyOf } from "../runtime/row-identity";
import { buildWidgetContext } from "../runtime/widget-context";
import { renderHistoryTab } from "./audit/history-tab";
import { recordAside, recordLayout, recordStrip } from "./detail-page/detail-body";
import { headerBadges, recordHeader } from "./detail-page/detail-header";
import { recordRange } from "./detail-page/record-context";
import { renderFieldsTab } from "./detail-tabs/render-fields-tab";
import { renderDetailTabs } from "./detail-tabs/render-tab";

type Row = Record<string, unknown>;

const DETAILS_TAB = "details";

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
  await requireAccessIfSet(resolveOperationAccess(resource.options.access, "read"), reqCtx);
  assertResourceScope({
    hasGlobal: !!config.scope,
    resourceScope: resource.options.scope,
  });

  const searchParams = new URL(req.url).searchParams;
  const {
    baseFields,
    readable,
    readableBaseFields,
    tabs,
    requestedTab,
    history,
    historyActive,
    firstRead,
  } = await detailReadPlan(config, resource, reqCtx, searchParams);
  const knownColumns = config.adapter.introspect(resource.ref).columns;
  const hasTabs = Array.isArray(tabs) && tabs.length > 0;

  const site: QuerySite = {
    config,
    resource: name,
    operation: "get",
    label: singularLabel(resource, name),
    record: true,
    ...(reqCtx.requestId ? { requestId: reqCtx.requestId } : {}),
  };
  const failed = (card: React.ReactNode) => (
    <>
      <PageHeader title={singularLabel(resource, name)} />
      {card}
    </>
  );
  const first = await readDetailRow(config, resource, reqCtx, id, knownColumns, {
    fields: firstRead,
    site,
  });
  if (first.failed) return failed(first.card);
  if (!first.value || first.value.visibility === "hidden") notFound();
  const { row, visibility } = first.value;

  const baseRow = projectRowFields(row, readableBaseFields);
  const visibleTabs = hasTabs ? (tabs ?? []).filter((tab) => !tab.hidden?.(baseRow)) : [];
  const active = hasTabs && !historyActive ? activeTab(visibleTabs, requestedTab) : undefined;
  const activeFields = active ? detailFieldsForTab(baseFields, active) : baseFields;
  const readableActiveFields = [...activeFields].filter((field) => readable.has(field));
  const read = new Set(firstRead);
  const needsActiveRead = readableActiveFields.some((field) => !read.has(field));
  let activeRow: Row | null = projectRowFields(row, readableActiveFields);
  if (needsActiveRead) {
    const second = await readDetailRow(config, resource, reqCtx, id, knownColumns, {
      fields: readableActiveFields,
      site,
    });
    if (second.failed) return failed(second.card);
    activeRow = second.value?.row ?? null;
  }
  if (!activeRow) notFound();

  const detail = resource.options.detail as DetailOptions<Row> | undefined;
  const rowKey = rowKeyOf(resource);
  const range = recordRange(config, detail, searchParams);
  const ctx = buildWidgetContext(config, reqCtx, req, range, activeRow, rowKey, name);
  const deleted = visibility === "deleted";
  const menu = await recordActions(config, resource, name, id, baseRow, reqCtx, deleted);
  const labels = mergeLabels(config.labels);
  const fieldsTab = () =>
    renderFieldsTab<Row>(config, reqCtx, resource, baseRow, {
      ...(detail?.fields ? { fields: detail.fields as DetailTab<Row>["fields"] } : {}),
    });
  const historyTab = async () => ({
    key: AUDIT_HISTORY_TAB,
    label: labels.audit.history,
    content: historyActive ? await renderHistoryTab(config, reqCtx, name, id, searchParams) : null,
  });
  const main = async (): Promise<React.ReactNode> => {
    if (hasTabs) {
      const declared = await renderDetailTabs<Row>({
        config,
        reqCtx,
        resource,
        row: activeRow,
        req,
        searchParams,
        visible: visibleTabs,
        active,
        ctx,
      });
      return <DetailTabsClient tabs={history ? [...declared, await historyTab()] : declared} />;
    }
    if (!history) return fieldsTab();
    const details = {
      key: DETAILS_TAB,
      label: labels.detail.details,
      content: historyActive ? null : await fieldsTab(),
    };
    return <DetailTabsClient tabs={[details, await historyTab()]} />;
  };
  const [header, strip, aside, body] = await Promise.all([
    recordHeader(resource, name, id, baseRow, ctx, config, reqCtx),
    recordStrip(detail, ctx, config, reqCtx, name),
    recordAside(detail, ctx, config, reqCtx, name),
    main(),
  ]);
  const picker = detail?.dateRange ? (
    <DashboardDateRange
      {...(range.preset === "custom"
        ? { from: range.from.toISOString(), to: range.to.toISOString() }
        : { preset: range.preset })}
      {...(detail.dateRange.presets ? { presets: detail.dateRange.presets } : {})}
    />
  ) : null;
  const hasMenu =
    menu.editHref !== null ||
    menu.delete !== null ||
    menu.rowActions.length > 0 ||
    menu.drawerActions.length > 0;
  const actions =
    picker || hasMenu ? (
      <>
        {picker}
        {hasMenu ? (
          <RecordActionsBar
            resource={name}
            id={id}
            {...menu}
            {...(resource.options.update?.emphasis
              ? { editEmphasis: resource.options.update.emphasis }
              : {})}
            afterDelete="list"
          />
        ) : null}
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
      {deleted ? deletedNotice(config, resource, name, id) : null}
      {recordLayout(strip, body, aside)}
    </>
  );
}

function activeTab<Row>(
  tabs: DetailTab<Row>[],
  requestedTab: string | null,
): DetailTab<Row> | undefined {
  return tabs.find((tab) => tab.key === requestedTab) ?? tabs[0];
}

async function readDetailRow(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
  id: string,
  knownColumns: ReadonlyArray<{ name: string }>,
  { fields, site }: { fields: Iterable<string>; site: QuerySite },
): Promise<QueryOutcome<{ row: Row; visibility: "live" | "deleted" | "hidden" } | null>> {
  const select = withSoftDeleteColumn(resource, selectKnownFields(fields, knownColumns));
  const got = await readOrCard(site, () => readRecord(config, resource, id, reqCtx, select));
  if (got.failed) return got;
  const row = got.value;
  if (!row) return { failed: false, value: null };
  return {
    failed: false,
    value: {
      row: projectRowFields(row, fields),
      visibility: await rowVisibility(resource, row, reqCtx),
    },
  };
}

function deletedNotice(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  name: string,
  id: string,
): React.ReactNode {
  const { detail } = mergeLabels(config.labels);
  return (
    <div className="fp-mb-6">
      <HealthBanner
        tone="warn"
        title={singularTitle(detail.deleted, resource, name)}
        description={detail.deletedDescription}
        {...(resource.options.update?.disabled
          ? {}
          : { action: <RestoreButton resource={name} id={id} /> })}
      />
    </div>
  );
}
