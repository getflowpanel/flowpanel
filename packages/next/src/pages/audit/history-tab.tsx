import type { RequestContext, ResolvedAdminConfig } from "@flowpanel/core";
import { mergeLabels } from "@flowpanel/core";
import { UrlPagination } from "@flowpanel/next/client";
import type { ReactNode } from "react";
import { auditReadFilter } from "../../runtime/audit-view";
import { parsePage } from "../../runtime/parse-list-params";
import { readOrCard } from "../../runtime/query-error";
import { AuditFeed, auditFeedItems } from "./audit-feed";

const HISTORY_PAGE = "historyPage";
const HISTORY_PAGE_SIZE = 20;

/** A record's audit events, newest first, twenty to a page. */
export async function renderHistoryTab(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  resource: string,
  id: string,
  searchParams: URLSearchParams,
): Promise<ReactNode> {
  const store = config.auditLog;
  if (!store) return null;
  const labels = mergeLabels(config.labels).audit;
  const page = parsePage(searchParams.get(HISTORY_PAGE));
  const bound = await auditReadFilter(config, reqCtx);
  const read = await readOrCard(
    {
      config,
      resource: "flowpanel_audit_log",
      operation: "list",
      label: labels.history,
      ...(reqCtx.requestId ? { requestId: reqCtx.requestId } : {}),
    },
    () =>
      store.list({
        ...bound,
        resource,
        targetId: id,
        limit: HISTORY_PAGE_SIZE,
        offset: (page - 1) * HISTORY_PAGE_SIZE,
      }),
  );
  if (read.failed) return read.card;
  const { entries, total } = read.value;
  if (entries.length === 0) {
    return (
      <div className="fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-6">
        <p className="fp-text-sm fp-text-faint">{labels.empty}</p>
      </div>
    );
  }
  const items = await auditFeedItems(config, reqCtx, entries, labels, { linkRecords: false });
  return (
    <div className="fp-space-y-3">
      <AuditFeed items={items} labels={labels} />
      <UrlPagination param={HISTORY_PAGE} page={page} pageSize={HISTORY_PAGE_SIZE} total={total} />
    </div>
  );
}
