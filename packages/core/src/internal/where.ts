import { didYouMean } from "../suggest";
import { isFilterRangeValue } from "../types/context";

type Bounds = { gte?: unknown; lte?: unknown };

function isBounds(value: object): value is Bounds {
  return (
    !(value instanceof Date) &&
    !Array.isArray(value) &&
    !("op" in value) &&
    ("gte" in value || "lte" in value || Object.keys(value).length === 0)
  );
}

/** Throws unless `field` is one of `columns`; an adapter that reports no columns is not checked. */
export function assertColumn(
  call: string,
  field: string,
  columns: readonly string[],
  verb = "filters by",
): void {
  if (columns.length === 0 || columns.includes(field)) return;
  throw new Error(
    `flowpanel: ${call} ${verb} "${field}", but the adapter reports no such column on that resource.` +
      `${didYouMean(field, columns)} Known columns: ${columns.map((c) => `"${c}"`).join(", ")}.`,
  );
}

/** A `where` value in the adapter's filter shape: `{ gte, lte }` is a range and an array a set. */
export function whereValue(value: unknown): unknown {
  if (Array.isArray(value)) return { op: "in", values: value.map(String) };
  if (typeof value !== "object" || value === null || !isBounds(value)) return value;
  return {
    op: "range",
    ...(value.gte !== undefined ? { gte: value.gte } : {}),
    ...(value.lte !== undefined ? { lte: value.lte } : {}),
  };
}

function unbounded(value: unknown): string | null {
  if (value === undefined || value === null) return String(value);
  if (value === "") return '""';
  if (typeof value !== "object" || value instanceof Date || Array.isArray(value)) return null;
  const range = value as { op?: unknown; gte?: unknown; lte?: unknown };
  const ranged = range.op === "range" || isBounds(value);
  return ranged && range.gte === undefined && range.lte === undefined ? "an open range" : null;
}

function emptySet(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  const set = value as { op?: unknown; values?: unknown } | null;
  return (
    typeof value === "object" &&
    set?.op === "in" &&
    Array.isArray(set.values) &&
    set.values.length === 0
  );
}

/**
 * A `where` checked against the resource's columns, in the adapter's filter shape, or `null`
 * when an empty set means no row can match. An unknown field, and a value that is `undefined`,
 * `null`, `""` or an open range, would silently match every row, so each throws; so does an
 * array holding a boolean, which would match the opposite rows.
 */
export function normalizeWhere(
  call: string,
  where: Record<string, unknown>,
  columns: readonly string[],
): Record<string, unknown> | null {
  const filters: Record<string, unknown> = {};
  let empty = false;
  for (const [field, value] of Object.entries(where)) {
    assertColumn(call, field, columns);
    const shown = unbounded(value);
    if (shown !== null) {
      throw new Error(
        `flowpanel: ${call} filters "${field}" by ${shown}, which would match every row. ` +
          'Leave the field out, or pass "__null__" to match an empty value.',
      );
    }
    if (Array.isArray(value) && value.some((item) => typeof item === "boolean")) {
      throw new Error(
        `flowpanel: ${call} filters "${field}" by an array that holds a boolean, which would ` +
          'reach the database as the text "true" or "false". Pass true or false as a plain value instead.',
      );
    }
    if (emptySet(value)) empty = true;
    filters[field] = whereValue(value);
  }
  return empty ? null : filters;
}

type Bound = number | Date;

const time = (bound: Bound): number => (bound instanceof Date ? bound.getTime() : bound);

/**
 * Filters plus the widget's range on `field`, as a link's `range` bounds it, or unchanged over a
 * whole history. A range the `where` already puts on `field` narrows to the overlap. A field that
 * is not a column, or one the `where` sets to a value that is not a range, throws.
 */
export function withRange(
  call: string,
  filters: Record<string, unknown>,
  field: string | undefined,
  range: { from: Date; to: Date },
  columns: readonly string[],
): Record<string, unknown> {
  if (field === undefined) return filters;
  assertColumn(call, field, columns, "ranges");
  const current = filters[field];
  if (current !== undefined && !isFilterRangeValue(current)) {
    throw new Error(
      `flowpanel: ${call} sets where.${field} to a value that is not a range and range: "${field}". Keep one.`,
    );
  }
  if (range.from.getTime() <= 0) return filters;
  const gte =
    current?.gte !== undefined && time(current.gte) > range.from.getTime()
      ? current.gte
      : range.from;
  const lte =
    current?.lte !== undefined && time(current.lte) < range.to.getTime() ? current.lte : range.to;
  return { ...filters, [field]: { op: "range", gte, lte } };
}
