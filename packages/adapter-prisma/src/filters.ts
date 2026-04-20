import type { NormalizedFilter } from "@flowpanel/core";

/**
 * Escape LIKE wildcards (%, _) in user-supplied search values to prevent
 * unintended pattern matching in Prisma contains/startsWith/endsWith.
 */
function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/**
 * Build a nested Prisma where clause from a dot-path like "user.email".
 * e.g. setNested({}, ["user", "email"], { contains: "foo" }) → { user: { email: { contains: "foo" } } }
 */
function setNested(
  obj: Record<string, unknown>,
  parts: string[],
  value: unknown,
): Record<string, unknown> {
  if (parts.length === 1) {
    const key = parts[0]!;
    const existing = obj[key];
    if (
      existing !== null &&
      existing !== undefined &&
      typeof existing === "object" &&
      !Array.isArray(existing) &&
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      // merge objects
      obj[key] = {
        ...(existing as Record<string, unknown>),
        ...(value as Record<string, unknown>),
      };
    } else {
      obj[key] = value;
    }
    return obj;
  }

  const key = parts[0]!;
  if (!obj[key] || typeof obj[key] !== "object" || Array.isArray(obj[key])) {
    obj[key] = {};
  }
  setNested(obj[key] as Record<string, unknown>, parts.slice(1), value);
  return obj;
}

function filterToCondition(filter: NormalizedFilter): unknown {
  const { op, value } = filter;

  switch (op) {
    case "eq":
      return value;
    case "neq":
      return { not: value };
    case "contains":
      return { contains: escapeLike(String(value)), mode: "insensitive" };
    case "startsWith":
      return { startsWith: escapeLike(String(value)), mode: "insensitive" };
    case "endsWith":
      return { endsWith: escapeLike(String(value)), mode: "insensitive" };
    case "in":
      return { in: value };
    case "notIn":
      return { notIn: value };
    case "gte":
      return { gte: value };
    case "lte":
      return { lte: value };
    case "gt":
      return { gt: value };
    case "lt":
      return { lt: value };
    case "isNull":
      return null;
    case "isNotNull":
      return { not: null };
    default:
      return value;
  }
}

export function normalizedFiltersToPrismaWhere(
  filters: NormalizedFilter[],
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const filter of filters) {
    const parts = filter.field.split(".");
    const condition = filterToCondition(filter);
    setNested(where, parts, condition);
  }

  return where;
}
