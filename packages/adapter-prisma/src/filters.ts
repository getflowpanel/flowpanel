import { isFilterInValue, isFilterRangeValue } from "@flowpanel/core";
import type { PrismaDmmf } from "./introspect";

type NumberKind = "int" | "bigint" | "float";

/** A model's Int, BigInt and Float fields, whose filter values arrive as strings from URLs and from other rows' keys. */
export function numberFields(modelName: string, dmmf: PrismaDmmf): Map<string, NumberKind> {
  const kinds = new Map<string, NumberKind>();
  const model = dmmf.datamodel.models.find((entry) => entry.name === modelName);
  for (const field of model?.fields ?? []) {
    if (field.type === "Int") kinds.set(field.name, "int");
    if (field.type === "BigInt") kinds.set(field.name, "bigint");
    if (field.type === "Float") kinds.set(field.name, "float");
  }
  return kinds;
}

function toNumber(value: unknown, kind: NumberKind | undefined): unknown {
  if (kind === undefined || typeof value !== "string" || value.trim() === "") return value;
  if (kind === "bigint") return /^-?\d+$/.test(value) ? BigInt(value) : value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (kind === "int" && !Number.isInteger(parsed))) return value;
  return parsed;
}

/** Translate FlowPanel filter values into one Prisma `where` object. */
export function buildFilterWhere(
  filters: Record<string, unknown> | undefined,
  numbers: ReadonlyMap<string, NumberKind> = new Map(),
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters ?? {})) {
    const kind = numbers.get(k);
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
      if (v.gte !== undefined) cond.gte = toNumber(v.gte, kind);
      if (v.lte !== undefined) cond.lte = toNumber(v.lte, kind);
      if (Object.keys(cond).length > 0) where[k] = cond;
      continue;
    }
    if (isFilterInValue(v)) {
      if (v.values.length > 0) where[k] = { in: v.values.map((value) => toNumber(value, kind)) };
      continue;
    }
    where[k] = toNumber(v, kind);
  }
  return where;
}
