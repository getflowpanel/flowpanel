import { type FilterCondition, filterConditions } from "@flowpanel/core/internal";
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

function prismaCondition(condition: FilterCondition, kind: NumberKind | undefined): unknown {
  switch (condition.op) {
    case "isNull":
      return null;
    case "notNull":
      return { not: null };
    case "range":
      return {
        ...(condition.gte !== undefined ? { gte: toNumber(condition.gte, kind) } : {}),
        ...(condition.lte !== undefined ? { lte: toNumber(condition.lte, kind) } : {}),
      };
    case "in":
      return { in: condition.values.map((value) => toNumber(value, kind)) };
    case "eq":
      return toNumber(condition.value, kind);
  }
}

/** Translate FlowPanel filter values into one Prisma `where` object. */
export function buildFilterWhere(
  filters: Record<string, unknown> | undefined,
  numbers: ReadonlyMap<string, NumberKind> = new Map(),
): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  for (const condition of filterConditions(filters)) {
    where[condition.field] = prismaCondition(condition, numbers.get(condition.field));
  }
  return where;
}
