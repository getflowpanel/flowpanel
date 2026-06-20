import type {
  ColumnDef,
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { checkRequireRole, runWithRequestContext } from "@flowpanel/core";
import { scopeBinding } from "./scope-binding.js";

export async function resolveReferences<Row extends Record<string, unknown>>(
  config: ResolvedAdminConfig,
  reqCtx: RequestContext,
  columnDefs: ReadonlyArray<keyof Row | ColumnDef<Row>>,
  rows: ReadonlyArray<Row>,
): Promise<Map<string, Map<string, unknown>>> {
  const out = new Map<string, Map<string, unknown>>();
  if (rows.length === 0) return out;

  for (const c of columnDefs) {
    if (typeof c === "string" || typeof c === "number" || typeof c === "symbol") continue;
    const def = c as ColumnDef<Row>;
    const ref = def.reference;
    if (!ref) continue;
    const field = String(def.field ?? "");
    if (!field) continue;

    const target = config.resourcesByName.get(ref.resource);
    if (!target) continue; // unregistered target — silently skip

    if (target.options.requireRole !== undefined) {
      try {
        checkRequireRole(target.options.requireRole, reqCtx.role, reqCtx.session);
      } catch {
        continue;
      }
    }

    const ids = new Set<string>();
    for (const row of rows) {
      const raw = row[field];
      if (raw === null || raw === undefined) continue;
      ids.add(String(raw));
    }
    if (ids.size === 0) continue;

    const labelMap = new Map<string, unknown>();
    const targetScope = scopeBinding(config, target, reqCtx);
    const lookups = await Promise.all(
      Array.from(ids).map(async (id) => {
        const itemCtx: ItemQueryContext = {
          ...reqCtx,
          db: config.adapter.db,
          dateRange: { from: new Date(0), to: new Date() },
          searchParams: new URLSearchParams(),
          signal: new AbortController().signal,
          id,
          ...targetScope,
        };
        const row = (await runWithRequestContext(reqCtx, () =>
          config.adapter.get(target.ref, itemCtx),
        )) as Record<string, unknown> | null;
        return { id, row };
      }),
    );
    for (const { id, row } of lookups) {
      if (!row) continue;
      const value = row[ref.labelField];
      if (value === undefined || value === null) continue;
      labelMap.set(id, value);
    }
    if (labelMap.size > 0) out.set(field, labelMap);
  }

  return out;
}
