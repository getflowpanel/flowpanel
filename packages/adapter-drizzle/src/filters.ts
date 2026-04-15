import type { NormalizedFilter } from "@flowpanel/core";

// We import from drizzle-orm via dynamic duck-typing to avoid hard-coding
// specific import paths that may differ across Drizzle versions.
// The functions below accept pre-resolved drizzle operator functions.
// For real usage we import directly; Drizzle is a peer dependency.

import {
  eq,
  ne,
  like,
  ilike,
  inArray,
  notInArray,
  gte,
  lte,
  gt,
  lt,
  isNull,
  isNotNull,
  and,
  type SQL,
} from "drizzle-orm";

/**
 * Translate a NormalizedFilter[] to a Drizzle SQL condition.
 *
 * Only top-level (non-dotted) field names are supported.
 * Nested dot-paths (e.g. "user.email") are skipped with a console.warn.
 *
 * @param filters  The normalized filters from FlowPanel core.
 * @param table    The Drizzle table object (typed as unknown for version resilience).
 * @returns        A Drizzle SQL condition, or undefined if no filters apply.
 */
export function normalizedFiltersToDrizzleWhere(
  filters: NormalizedFilter[],
  table: unknown,
): SQL | undefined {
  const tableRecord = table as Record<string, unknown>;
  const conditions: SQL[] = [];

  for (const filter of filters) {
    // Skip nested paths — not supported in SQL-like builder
    if (filter.field.includes(".")) {
      console.warn(
        `[flowpanel] drizzle adapter: nested filter path "${filter.field}" is not supported in SQL builder mode — skipping`,
      );
      continue;
    }

    const column = tableRecord[filter.field];
    if (!column) {
      console.warn(
        `[flowpanel] drizzle adapter: column "${filter.field}" not found on table — skipping filter`,
      );
      continue;
    }

    // biome-ignore lint/suspicious/noExplicitAny: Drizzle column type is opaque
    const col = column as any;
    const { op, value } = filter;

    let condition: SQL | undefined;

    switch (op) {
      case "eq":
        condition = eq(col, value);
        break;
      case "neq":
        condition = ne(col, value);
        break;
      case "contains":
        // Use ilike for case-insensitive matching when possible
        condition = ilike(col, `%${value}%`);
        break;
      case "startsWith":
        condition = ilike(col, `${value}%`);
        break;
      case "endsWith":
        condition = ilike(col, `%${value}`);
        break;
      case "in":
        condition = inArray(col, value as unknown[]);
        break;
      case "notIn":
        condition = notInArray(col, value as unknown[]);
        break;
      case "gte":
        condition = gte(col, value);
        break;
      case "lte":
        condition = lte(col, value);
        break;
      case "gt":
        condition = gt(col, value);
        break;
      case "lt":
        condition = lt(col, value);
        break;
      case "isNull":
        condition = isNull(col);
        break;
      case "isNotNull":
        condition = isNotNull(col);
        break;
      default:
        console.warn(`[flowpanel] drizzle adapter: unsupported filter op "${op}" — skipping`);
        continue;
    }

    if (condition) {
      conditions.push(condition);
    }
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return and(...conditions);
}
