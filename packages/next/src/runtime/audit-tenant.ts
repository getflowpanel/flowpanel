import type { AuditEvent, RequestContext, ResolvedAdminConfig, Scope } from "@flowpanel/core";
import { isAllTenants } from "@flowpanel/core";
import { auditScopeKey } from "@flowpanel/core/internal";
import { readRow } from "./read-row";

export type AffectedRows = ReadonlyMap<string, Record<string, unknown>>;

export function auditTargets(ids: readonly string[]): string {
  return ids.slice(0, 10).join(",") + (ids.length > 10 ? "…" : "");
}

function targetsOf(event: AuditEvent): readonly string[] {
  if (event.targetIds?.length) return event.targetIds;
  return event.targetId === undefined ? [] : [event.targetId];
}

/** One event per tenant of the rows an `allTenants` write touched, before and after; a moved row files under both. */
export async function tenantEvents(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  event: AuditEvent,
  rows: AffectedRows = new Map(),
): Promise<AuditEvent[]> {
  if (!isAllTenants(reqCtx.scope) || event.resource === undefined) return [event];
  const resource = config.resourcesByName.get(event.resource);
  const scopeOf = resource?.options.scopeOf;
  const ids = targetsOf(event);
  if (!resource || !scopeOf || ids.length === 0) return [event];

  const groups = new Map<string | null, { scope: Scope; ids: string[] }>();
  const single = event.targetIds === undefined;
  for (const id of ids) {
    const before = rows.get(id);
    const after = single || !before ? await readRow(config, resource, id, reqCtx) : null;
    const scopes = [before, after].flatMap((row) => (row ? [scopeOf(row)] : []));
    for (const scope of scopes.length > 0 ? scopes : [null]) {
      const key = auditScopeKey(scope);
      let group = groups.get(key);
      if (!group) {
        group = { scope, ids: [] };
        groups.set(key, group);
      }
      if (!group.ids.includes(id)) group.ids.push(id);
    }
  }
  const { scope: _actor, ...base } = event;
  return [...groups.values()].map(({ scope, ids: own }) => ({
    ...base,
    ...(scope ? { scope } : {}),
    ...(event.targetIds === undefined ? {} : { targetId: auditTargets(own), targetIds: own }),
  }));
}
