import type {
  ColumnDef,
  FilterInValue,
  RequestContext,
  ResolvedAdminConfig,
} from "@flowpanel/core";
import { readRelatedRows } from "./require-authorized";

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

    const ids = new Set<string>();
    for (const row of rows) {
      const raw = row[field];
      if (raw === null || raw === undefined) continue;
      ids.add(String(raw));
    }
    if (ids.size === 0) continue;

    const pk = config.adapter.introspect(target.ref).primaryKey;
    const idFilter: FilterInValue = { op: "in", values: Array.from(ids) };
    const targetRows = await readRelatedRows(config, target, reqCtx, {
      filters: { [pk]: idFilter },
      pageSize: ids.size,
      extraFields: [pk, ref.labelField],
      includeDeleted: true,
    });
    if (!targetRows) continue;

    const labelMap = new Map<string, unknown>();
    for (const targetRow of targetRows) {
      const id = targetRow[pk];
      if (id === null || id === undefined) continue;
      const value = targetRow[ref.labelField];
      if (value === undefined || value === null) continue;
      labelMap.set(String(id), value);
    }
    if (labelMap.size > 0) out.set(field, labelMap);
  }

  return out;
}
