import type {
  AuditLogEntry,
  AuditLogQuery,
  AuditLogVisibility,
  RequestContext,
  ResolvedAdminConfig,
  ResolvedLabels,
  ResourceConfig,
} from "@flowpanel/core";
import {
  accessAllows,
  filterReadableProjection,
  formatLabel,
  humanize,
  isAllTenants,
  resolveOperationAccess,
} from "@flowpanel/core";
import {
  AUDIT_VALUE_PREVIEW,
  auditScopeKey,
  auditValueText,
  cutAuditText,
  DASHBOARD_ACTION_PREFIX,
  dashboardActionAudit,
  isBuiltinBulkDelete,
  isLongAuditValue,
  storedAuditPreview,
} from "@flowpanel/core/internal";

/** The Audit log page's URL segment, which FlowPanel reserves. */
export const AUDIT_LOG_SEGMENT = "audit-log";

/** The record History tab's key in `?tab=`. */
export const AUDIT_HISTORY_TAB = "history";

/** Characters of previews one event may carry in total, so a page of events stays small. */
export const AUDIT_EVENT_PREVIEW = 2000;

export { AUDIT_VALUE_PREVIEW, auditValueText };

/** The start of a value too long to print whole; the full text comes from the audit value route. */
export interface AuditValuePreview {
  readonly preview: true;
  /** The first characters of the value as text (a string as is, an object as JSON). */
  readonly text: string;
  /** The full value's length in characters, as text. */
  readonly length: number;
}

export function isAuditValuePreview(value: unknown): value is AuditValuePreview {
  return (
    typeof value === "object" &&
    value !== null &&
    "preview" in value &&
    value.preview === true &&
    "text" in value &&
    typeof value.text === "string" &&
    "length" in value &&
    typeof value.length === "number"
  );
}

/** A stored preview or a long value read whole, cut to what is left of the event's budget. */
class PreviewBudget {
  #left = AUDIT_EVENT_PREVIEW;

  take(value: unknown): unknown {
    const stored = storedAuditPreview(value);
    if (!stored && !isLongAuditValue(value)) return value;
    const full = stored?.text ?? auditValueText(value);
    const text = cutAuditText(full, Math.min(AUDIT_VALUE_PREVIEW, this.#left));
    this.#left -= text.length;
    return {
      preview: true,
      text,
      length: stored?.length ?? full.length,
    } satisfies AuditValuePreview;
  }
}

/** One changed field as the reader may see it; a side the event did not have is `undefined`. */
export interface AuditChange {
  field: string;
  before: unknown;
  after: unknown;
}

/** Whether the caller may read the audit table: it exists and `audit.access` admits them. */
export async function auditReadable(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
): Promise<boolean> {
  if (!config.auditLog) return false;
  return accessAllows(config.audit?.access, reqCtx);
}

/** A record shows History unless its resource opts out of audit or of the tab. */
export function historyEnabled(config: ResolvedAdminConfig, resource: ResourceConfig): boolean {
  return (
    config.auditLog !== null &&
    resource.options.audit !== false &&
    resource.options.detail?.history !== false
  );
}

/** The resources this reader may read, and the dashboard actions they may run: what their events may show. */
export async function auditVisibility(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
): Promise<AuditLogVisibility> {
  const resources: string[] = [];
  for (const [name, resource] of config.resourcesByName) {
    if (await accessAllows(resolveOperationAccess(resource.options.access, "read"), reqCtx)) {
      resources.push(name);
    }
  }
  const actions: string[] = [];
  for (const dashboard of config.dashboardsByPath.values()) {
    if (!(await accessAllows(dashboard.access, reqCtx))) continue;
    for (const action of dashboard.actions ?? []) {
      if (await accessAllows(action.access, reqCtx)) {
        actions.push(dashboardActionAudit(dashboard.path, action.key).action);
      }
    }
  }
  return { resources, actions };
}

/** What every audit read binds: the reader's visible resources and, under a global `scope`, their tenant. */
export async function auditReadFilter(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
): Promise<Pick<AuditLogQuery, "scope" | "visible">> {
  return {
    visible: await auditVisibility(config, reqCtx),
    ...(config.scope && !isAllTenants(reqCtx.scope)
      ? { scope: { key: auditScopeKey(reqCtx.scope) } }
      : {}),
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** One side of one stored field, or `undefined` when the event did not have it. */
export function auditDiffValue(
  diff: AuditLogEntry["diff"],
  field: string,
  side: "before" | "after",
): unknown {
  const values = record(diff?.[side]);
  return values && Object.hasOwn(values, field) ? values[field] : undefined;
}

/** The changed `allowed` fields in stored order, each long value an `AuditValuePreview` within the event's budget. */
export function projectAuditDiff(
  diff: AuditLogEntry["diff"],
  allowed: ReadonlySet<string>,
): AuditChange[] {
  if (!diff) return [];
  const before = record(diff.before);
  const after = record(diff.after);
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const budget = new PreviewBudget();
  const changes: AuditChange[] = [];
  for (const field of fields) {
    if (!allowed.has(field)) continue;
    const was = auditDiffValue(diff, field, "before");
    const now = auditDiffValue(diff, field, "after");
    if (before && after && Object.is(was, now)) continue;
    changes.push({ field, before: budget.take(was), after: budget.take(now) });
  }
  return changes;
}

/** The fields of `resource` this reader may see in a diff: readable to them, never `sensitive`. */
export async function readableDiffFields(
  config: ResolvedAdminConfig,
  resource: ResourceConfig,
  diffs: ReadonlyArray<AuditLogEntry["diff"]>,
  reqCtx: RequestContext,
): Promise<Set<string>> {
  const fields = new Set<string>();
  for (const diff of diffs) {
    for (const side of [diff?.before, diff?.after]) {
      for (const field of Object.keys(record(side) ?? {})) fields.add(field);
    }
  }
  const secret = new Set(
    config.adapter
      .introspect(resource.ref)
      .columns.filter((column) => column.sensitive)
      .map((column) => column.name),
  );
  const readable = await filterReadableProjection(
    [...fields].filter((field) => !secret.has(field)),
    resource.options.fieldAccess,
    reqCtx,
  );
  return new Set(readable);
}

function actionLabel(
  actions: ReadonlyArray<{ key: string; label: string }> | undefined,
  key: string,
): string {
  return actions?.find((action) => action.key === key)?.label ?? humanize(key);
}

/** What an event did, in the reader's words: "Updated", or "Ran Refund" for a declared action. */
export function describeAuditAction(
  config: ResolvedAdminConfig,
  entry: Pick<AuditLogEntry, "action" | "resource">,
  labels: ResolvedLabels["audit"],
): string {
  const ran = (label: string) => formatLabel(labels.ran, { action: label });
  if (entry.action.startsWith(DASHBOARD_ACTION_PREFIX)) {
    for (const dashboard of config.dashboardsByPath.values()) {
      for (const action of dashboard.actions ?? []) {
        if (dashboardActionAudit(dashboard.path, action.key).action === entry.action) {
          return ran(action.label);
        }
      }
    }
    return ran(humanize(entry.action.slice(entry.action.lastIndexOf(".") + 1)));
  }
  const resource = entry.resource ? config.resourcesByName.get(entry.resource) : undefined;
  const prefix = `${entry.resource ?? ""}.`;
  const rest = entry.action.startsWith(prefix) ? entry.action.slice(prefix.length) : entry.action;
  const [kind = "", ...keyParts] = rest.split(".");
  const key = keyParts.join(".");
  switch (kind) {
    case "create":
      return labels.created;
    case "update":
    case "inline-update":
      return labels.updated;
    case "delete":
      return labels.deleted;
    case "restore":
      return labels.restored;
    case "export":
      return labels.exported;
    case "bulk": {
      const bulk = resource?.options.bulkActions?.find((action) => action.key === key);
      if (bulk && isBuiltinBulkDelete(bulk)) return labels.deleted;
      return ran(actionLabel(resource?.options.bulkActions, key));
    }
    case "action":
      return ran(actionLabel(resource?.options.actions, key));
    case "drawer":
      return ran(actionLabel(resource?.options.drawer?.actions, key));
    default:
      return entry.action;
  }
}
