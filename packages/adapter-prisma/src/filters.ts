import { isFilterInValue, isFilterRangeValue } from "@flowpanel/core";

/** Translate FlowPanel filter values into one Prisma `where` object. */
export function buildFilterWhere(
  filters: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters ?? {})) {
    if (v === undefined || v === null || v === "") continue;
    if (v === "__null__") {
      where[k] = null;
      continue;
    }
    if (v === "__notnull__") {
      where[k] = { not: null };
      continue;
    }
    if (isFilterRangeValue(v)) {
      const cond: Record<string, unknown> = {};
      if (v.gte !== undefined) cond.gte = v.gte;
      if (v.lte !== undefined) cond.lte = v.lte;
      if (Object.keys(cond).length > 0) where[k] = cond;
      continue;
    }
    if (isFilterInValue(v)) {
      if (v.values.length > 0) where[k] = { in: v.values };
      continue;
    }
    where[k] = v;
  }
  return where;
}
