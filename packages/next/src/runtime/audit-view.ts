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
  auditScopeKey,
  DASHBOARD_ACTION_PREFIX,
  dashboardActionAudit,
  isBuiltinBulkDelete,
} from "@flowpanel/core/internal";

/** The Audit log page's URL segment, which FlowPanel reserves. */
export const AUDIT_LOG_SEGMENT = "audit-log";

/** The record History tab's key in `?tab=`. */
export const AUDIT_HISTORY_TAB = "history";

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

/** The stored before/after as changed fields, keeping only `allowed` ones in their stored order. */
export function projectAuditDiff(
  diff: AuditLogEntry["diff"],
  allowed: ReadonlySet<string>,
): AuditChange[] {
  if (!diff) return [];
  const before = record(diff.before);
  const after = record(diff.after);
  const fields = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: AuditChange[] = [];
  for (const field of fields) {
    if (!allowed.has(field)) continue;
    const was = before && Object.hasOwn(before, field) ? before[field] : undefined;
    const now = after && Object.hasOwn(after, field) ? after[field] : undefined;
    if (before && after && Object.is(was, now)) continue;
    changes.push({ field, before: was, after: now });
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
