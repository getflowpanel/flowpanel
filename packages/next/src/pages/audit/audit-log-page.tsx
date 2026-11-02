import type {
  AuditLogFacets,
  AuditLogQuery,
  AuditLogStore,
  RequestContext,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { formatLabel, mergeLabels, resolveFormatting } from "@flowpanel/core";
import { AUDIT_COUNT_CAP, dayStartIn, shiftDayKey } from "@flowpanel/core/internal";
import { AuditLogFilters, UrlPagination } from "@flowpanel/next/client";
import { PageHeader } from "@flowpanel/react";
import type { ReactNode } from "react";
import { auditReadFilter, describeAuditAction } from "../../runtime/audit-view";
import { parsePage } from "../../runtime/parse-list-params";
import { readOrCard } from "../../runtime/query-error";
import { pluralLabel } from "../../runtime/resource-title";
import { AuditFeed, auditFeedItems } from "./audit-feed";

const PAGE_SIZE = 50;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `YYYY-MM-DD:YYYY-MM-DD` as instants in the admin's time zone, the end day included. */
function dateBounds(raw: string | null, timeZone: string): Pick<AuditLogQuery, "from" | "to"> {
  const [from = "", to = ""] = (raw ?? "").split(":");
  return {
    ...(DAY.test(from) ? { from: dayStartIn(from, timeZone) } : {}),
    ...(DAY.test(to) ? { to: dayStartIn(shiftDayKey(to, 1), timeZone) } : {}),
  };
}

const FACET_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;
const FACET_TTL_MS = 60_000;
const facetMemo = new WeakMap<
  AuditLogStore,
  Map<string, { expires: number; facets: Promise<AuditLogFacets> }>
>();

/** Who acted and what ran in the last 90 days, read at most once a minute per reader's filter. */
function recentFacets(
  store: AuditLogStore,
  bound: Pick<AuditLogQuery, "scope" | "visible">,
): Promise<AuditLogFacets> {
  const now = Date.now();
  const key = JSON.stringify(bound);
  const memo = facetMemo.get(store) ?? new Map();
  facetMemo.set(store, memo);
  const hit = memo.get(key);
  if (hit && hit.expires > now) return hit.facets;
  for (const [stale, entry] of memo) if (entry.expires <= now) memo.delete(stale);
  const facets = store.facets({ ...bound, from: new Date(now - FACET_WINDOW_MS) });
  facets.catch(() => memo.delete(key));
  memo.set(key, { expires: now + FACET_TTL_MS, facets });
  return facets;
}

function filterValue(sp: URLSearchParams, key: string): string | undefined {
  const value = sp.get(key);
  return value ? value : undefined;
}

/** Every audit event the reader may see, filterable by who, resource, action and date. */
export async function AuditLogPage({
  config,
  reqCtx,
  searchParams,
}: {
  config: ResolvedAdminConfig;
  reqCtx: RequestContext;
  searchParams: URLSearchParams;
}): Promise<ReactNode> {
  const store = config.auditLog;
  if (!store) return null;
  const labels = mergeLabels(config.labels).audit;
  const { timeZone, locale } = resolveFormatting(config.formatting);
  const page = parsePage(searchParams.get("page"));
  const bound = await auditReadFilter(config, reqCtx);
  const actor = filterValue(searchParams, "actor");
  const resource = filterValue(searchParams, "resource");
  const action = filterValue(searchParams, "action");
  const query: AuditLogQuery = {
    ...bound,
    ...(actor ? { actorId: actor } : {}),
    ...(resource ? { resource } : {}),
    ...(action ? { action } : {}),
    ...dateBounds(searchParams.get("date"), timeZone),
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  };
  const read = await readOrCard(
    {
      config,
      resource: "flowpanel_audit_log",
      operation: "list",
      label: labels.title,
      ...(reqCtx.requestId ? { requestId: reqCtx.requestId } : {}),
    },
    () => Promise.all([store.list(query), recentFacets(store, bound)]),
  );
  const header = <PageHeader title={labels.title} description={labels.description} />;
  if (read.failed) {
    return (
      <>
        {header}
        {read.card}
      </>
    );
  }
  const [{ entries, total, capped }, facets] = read.value;
  const visible = new Set(bound.visible?.resources ?? []);
  const resources = [...config.resourcesByName]
    .filter(([name]) => visible.has(name))
    .map(([name, r]) => ({ value: name, label: pluralLabel(r, name) }));
  const resourceLabel = new Map(resources.map((r) => [r.value, r.label]));
  const actions = facets.actions.map((value) => {
    const owner = value.split(".")[0] ?? "";
    const verb = describeAuditAction(
      config,
      { action: value, resource: config.resourcesByName.has(owner) ? owner : null },
      labels,
    );
    const ownerLabel = resourceLabel.get(owner);
    return {
      value,
      label: ownerLabel
        ? formatLabel(labels.actionOption, { resource: ownerLabel, action: verb })
        : verb,
    };
  });
  const filtered = Boolean(actor || resource || action || searchParams.get("date"));
  const items = await auditFeedItems(config, reqCtx, entries, labels, { linkRecords: true });
  return (
    <>
      {header}
      <div className="fp-space-y-4">
        <AuditLogFilters
          actors={facets.actors.map((a) => ({ value: a.id, label: a.name ?? a.id }))}
          resources={resources}
          actions={actions}
        />
        {items.length === 0 ? (
          <div className="fp-rounded-lg fp-border fp-border-line fp-bg-surface fp-p-6">
            <p className="fp-text-sm fp-text-faint">
              {filtered ? labels.emptyFiltered : labels.empty}
            </p>
          </div>
        ) : (
          <AuditFeed items={items} labels={labels} />
        )}
        {capped ? (
          <p className="fp-text-sm fp-text-faint">
            {formatLabel(labels.capped, { n: AUDIT_COUNT_CAP.toLocaleString(locale) })}
          </p>
        ) : null}
        <UrlPagination param="page" page={page} pageSize={PAGE_SIZE} total={total} />
      </div>
    </>
  );
}
