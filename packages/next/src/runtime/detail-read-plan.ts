import type {
  DetailTab,
  RequestContext,
  ResolvedAdminConfig,
  ResourceConfig,
} from "@flowpanel/core";
import { filterReadableProjection } from "@flowpanel/core";
import { AUDIT_HISTORY_TAB, auditReadable, historyEnabled } from "./audit-view";
import { declaredDetailBaseFields, declaredDetailPolicyFields } from "./project-row";

type Row = Record<string, unknown>;

/** Build a tab's explicitly declared field dependencies without reading `*` as a DB wildcard. */
export function detailFieldsForTab<Row>(baseFields: Set<string>, tab: DetailTab<Row>): Set<string> {
  const fields = new Set(baseFields);
  const add = (list: unknown) => {
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if (typeof entry === "string" || typeof entry === "number" || typeof entry === "symbol") {
        fields.add(String(entry));
      } else if (entry && typeof entry === "object" && typeof entry.name === "string") {
        fields.add(entry.name);
      }
    }
  };
  add(tab.fields);
  for (const section of tab.sections ?? []) add(section.fields);
  return fields;
}

/** What a record page reads, decided before the row loads; its `<title>` reads the same first select. */
export interface DetailReadPlan {
  baseFields: Set<string>;
  /** Every declared field this caller may read, resolved once for both reads. */
  readable: Set<string>;
  readableBaseFields: string[];
  tabs: DetailTab<Row>[] | undefined;
  requestedTab: string | null;
  history: boolean;
  historyActive: boolean;
  /** The base fields, plus the requested tab's when it is known before any `hidden` runs. */
  firstRead: string[];
}

function initialActiveTab(
  tabs: readonly DetailTab<Row>[],
  requestedTab: string | null,
): DetailTab<Row> | undefined {
  const requested = tabs.find((tab) => tab.key === requestedTab);
  if (requested) return requested.hidden ? undefined : requested;
  return tabs[0]?.hidden ? undefined : tabs[0];
}

export async function detailReadPlan(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  reqCtx: RequestContext,
  searchParams: URLSearchParams,
): Promise<DetailReadPlan> {
  const baseFields = declaredDetailBaseFields(resource);
  const readable = new Set(
    await filterReadableProjection(
      [...declaredDetailPolicyFields(resource)],
      resource.options.fieldAccess,
      reqCtx,
    ),
  );
  const tabs = resource.options.detail?.tabs as DetailTab<Row>[] | undefined;
  const requestedTab = searchParams.get("tab");
  const history =
    historyEnabled(config, resource) &&
    !(tabs ?? []).some((tab) => tab.key === AUDIT_HISTORY_TAB) &&
    (await auditReadable(config, reqCtx));
  const historyActive = history && requestedTab === AUDIT_HISTORY_TAB;
  const initial = historyActive ? undefined : initialActiveTab(tabs ?? [], requestedTab);
  const initialFields = initial ? detailFieldsForTab(baseFields, initial) : baseFields;
  return {
    baseFields,
    readable,
    readableBaseFields: [...baseFields].filter((field) => readable.has(field)),
    tabs,
    requestedTab,
    history,
    historyActive,
    firstRead: [...initialFields].filter((field) => readable.has(field)),
  };
}
