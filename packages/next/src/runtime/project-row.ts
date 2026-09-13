import type { RequestContext, ResourceConfig } from "@flowpanel/core";
import { filterReadableProjection } from "@flowpanel/core";
import { DEFAULT_RESOURCE_ROW_KEY } from "./defaults";

/** Add a single declared-field entry to `fields`. */
function addField(fields: Set<string>, entry: unknown): void {
  if (typeof entry === "string") {
    if (entry) fields.add(entry);
    return;
  }
  if (entry && typeof entry === "object") {
    const named = entry as { field?: unknown; name?: unknown };
    const f = named.field ?? named.name;
    if (typeof f === "string" && f) fields.add(f);
  }
}

/** Add every field in a declared field list to `fields`. */
function addFieldList(fields: Set<string>, list: unknown): void {
  if (!Array.isArray(list)) return;
  for (const entry of list) addField(fields, entry);
}

/** Fields a list may load or send to its client table. */
export function declaredRowFields(resource: ResourceConfig): Set<string> {
  const fields = new Set<string>();
  const options = resource.options as {
    columns?: unknown[];
    expose?: unknown[];
    rowKey?: string;
  };

  for (const c of options.columns ?? []) addField(fields, c);
  addFieldList(fields, options.expose);
  fields.add(options.rowKey ?? DEFAULT_RESOURCE_ROW_KEY);

  return fields;
}

/** Fields a drawer may load without widening its parent list. */
export function declaredDrawerRowFields(resource: ResourceConfig): Set<string> {
  const fields = declaredRowFields(resource);
  const drawer = resource.options.drawer as
    | { fields?: unknown; tabs?: ReadonlyArray<{ fields?: unknown }> }
    | undefined;
  addFieldList(fields, drawer?.fields);
  for (const tab of drawer?.tabs ?? []) addFieldList(fields, tab?.fields);
  return fields;
}

/** Stable detail header and fallback presentation dependencies. */
export function declaredDetailBaseFields(resource: ResourceConfig): Set<string> {
  const fields = declaredRowFields(resource);
  const detail = resource.options.detail as { expose?: unknown[]; fields?: unknown } | undefined;
  addFieldList(fields, detail?.expose);
  addFieldList(fields, detail?.fields);
  return fields;
}

/** Every declared detail field, used only to resolve read policy once per request. */
export function declaredDetailPolicyFields(resource: ResourceConfig): Set<string> {
  const fields = declaredDetailBaseFields(resource);
  const detail = resource.options.detail as
    | { tabs?: ReadonlyArray<{ fields?: unknown; sections?: ReadonlyArray<{ fields?: unknown }> }> }
    | undefined;
  for (const tab of detail?.tabs ?? []) {
    addFieldList(fields, tab?.fields);
    for (const section of tab?.sections ?? []) addFieldList(fields, section?.fields);
  }
  return fields;
}

/** Intersect a requested projection with adapter introspection without ever omitting `select`. */
export function selectKnownFields(
  fields: Iterable<string>,
  columns: ReadonlyArray<{ name: string }>,
): string[] {
  const known = new Set(columns.map((column) => column.name));
  return [...new Set(fields)].filter((field) => known.has(field));
}

/** Project a row through a read-policy result that was resolved before its adapter query. */
export function projectRowFields<Row extends Record<string, unknown>>(
  row: Row,
  readable: Iterable<string>,
): Row {
  const out: Record<string, unknown> = {};
  for (const field of readable) {
    if (Object.hasOwn(row, field)) out[field] = row[field];
  }
  return out as Row;
}

/** Resolve the readable field set for a resource's rows once per request. */
export async function resolveRowProjection(
  resource: ResourceConfig,
  reqCtx: RequestContext,
  extraFields?: Iterable<string>,
): Promise<string[]> {
  const fields = declaredRowFields(resource);
  if (extraFields) for (const field of extraFields) fields.add(field);
  return await filterReadableProjection([...fields], resource.options.fieldAccess, reqCtx);
}

/** Request-aware projection for every server/client and HTTP row boundary. */
export async function projectAuthorizedRow<Row extends Record<string, unknown>>(
  resource: ResourceConfig,
  row: Row,
  reqCtx: RequestContext,
  extraFields?: Iterable<string>,
): Promise<Row> {
  return projectRowFields(row, await resolveRowProjection(resource, reqCtx, extraFields));
}

/** A page of rows shares one policy decision; a field policy may be async. */
export async function projectAuthorizedRows<Row extends Record<string, unknown>>(
  resource: ResourceConfig,
  rows: readonly Row[],
  reqCtx: RequestContext,
  extraFields?: Iterable<string>,
): Promise<Row[]> {
  const readable = await resolveRowProjection(resource, reqCtx, extraFields);
  return rows.map((row) => projectRowFields(row, readable));
}
