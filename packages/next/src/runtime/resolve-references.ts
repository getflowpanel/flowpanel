import type {
  ColumnDef,
  ItemQueryContext,
  RequestContext,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { checkRequireRole, runWithRequestContext } from "@flowpanel/core";
import { scopeBinding } from "./scope-binding.js";

/**
 * For columns whose `ColumnDef.reference` points at another registered
 * resource, resolve the looked-up label so the list table can render
 * `<Link>` cells instead of raw foreign-key values.
 *
 * Implementation is intentionally adapter-agnostic: we issue parallel
 * `adapter.get()` calls per unique ID. Most adapters back that with a
 * primary-key lookup that the DB plans as a single index hit, and the
 * `Promise.all` lets the underlying pool overlap them.
 *
 * Returns a per-column map: `field → (idValue → labelValue)`. A missing
 * entry means the row's FK value is null, the lookup returned no row,
 * or the target resource isn't registered in `config`. In all three cases
 * the consumer renders the raw value (or `—` for nulls) — never throws.
 *
 * @example
 * ```ts
 * const labels = await resolveReferences(config, reqCtx, columnDefs, rows);
 * const userLabel = labels.get("userId")?.get(row.userId);  // "user@example.com"
 * ```
 */
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

    // Role-gate the target like its own list page would: a FK label must not
    // surface a resource the viewer lacks the role to read. Skip the column
    // (raw value renders) rather than throw.
    if (target.options.requireRole !== undefined) {
      try {
        checkRequireRole(target.options.requireRole, reqCtx.role, reqCtx.session);
      } catch {
        continue;
      }
    }

    // Collect unique non-null FK values for this column on this page.
    const ids = new Set<string>();
    for (const row of rows) {
      const raw = row[field];
      if (raw === null || raw === undefined) continue;
      ids.add(String(raw));
    }
    if (ids.size === 0) continue;

    // Parallel point-lookups via the adapter. Each call is a PK fetch —
    // typically a single index hit; the runtime overlaps them through the
    // connection pool. Future optimization: bulk fetch via a new
    // `adapter.getMany(ref, ids)` once a few adapters need it.
    const labelMap = new Map<string, unknown>();
    // Bind the TARGET resource's scope so FK label lookups can't leak a
    // cross-tenant row's label.
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
