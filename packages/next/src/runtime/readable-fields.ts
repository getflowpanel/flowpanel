import type { ColumnDef, FieldAccessMap, RequestContext } from "@flowpanel/core";
import { filterReadableProjection } from "@flowpanel/core";

type Row = Record<string, unknown>;

/** Return the named field behind a column/filter/search declaration. */
export function declaredFieldName(entry: unknown): string | null {
  if (typeof entry === "string" || typeof entry === "number" || typeof entry === "symbol") {
    return String(entry);
  }
  if (!entry || typeof entry !== "object") return null;
  const field = (entry as { field?: unknown }).field;
  return typeof field === "string" && field ? field : null;
}

/** Resolve a field set once so every query/UI surface observes the same access decision. */
export async function resolveReadableFieldSet(
  fields: Iterable<string>,
  policies: FieldAccessMap<Row> | undefined,
  reqCtx: RequestContext,
): Promise<Set<string>> {
  const unique = [...new Set(fields)];
  return new Set(await filterReadableProjection(unique, policies, reqCtx));
}

/** Filter named declarations through an already-resolved read policy. */
export function filterReadableDeclarations<T>(
  entries: ReadonlyArray<T> | undefined,
  readable: ReadonlySet<string>,
): T[] {
  return (entries ?? []).filter((entry) => {
    const field = declaredFieldName(entry);
    return field !== null && readable.has(field);
  });
}

/** Keep field-less render columns, but remove named columns rejected by read policy. */
export function filterColumnsByReadableFields(
  columns: ReadonlyArray<keyof Row | ColumnDef<Row>>,
  readable: ReadonlySet<string>,
): ReadonlyArray<keyof Row | ColumnDef<Row>> {
  return columns.filter((column) => {
    const field = declaredFieldName(column);
    return field === null || readable.has(field);
  });
}

/** Remove denied list controls from the raw request context passed to adapters. */
export function sanitizeReadableListSearchParams(
  source: URLSearchParams,
  readable: ReadonlySet<string>,
  searchEnabled: boolean,
): URLSearchParams {
  const params = new URLSearchParams(source);
  for (const key of [...params.keys()]) {
    const field = key.startsWith("f_")
      ? key.slice(2)
      : key.startsWith("filter.")
        ? key.slice("filter.".length)
        : null;
    if (field !== null && !readable.has(field)) params.delete(key);
  }

  const sortField = params.get("sort")?.split(":", 1)[0];
  if (sortField && !readable.has(sortField)) params.delete("sort");
  if (!searchEnabled) {
    params.delete("q");
    params.delete("search");
  }
  return params;
}

/** Remove named columns the current request may not read; field-less render columns stay explicit. */
export async function resolveReadableColumns(
  columns: ReadonlyArray<keyof Row | ColumnDef<Row>>,
  policies: FieldAccessMap<Row> | undefined,
  reqCtx: RequestContext,
): Promise<ReadonlyArray<keyof Row | ColumnDef<Row>>> {
  const named = columns.map(declaredFieldName).filter((field): field is string => field !== null);
  const readable = await resolveReadableFieldSet(named, policies, reqCtx);
  return filterColumnsByReadableFields(columns, readable);
}
