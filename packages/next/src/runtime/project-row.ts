import type { RequestContext, ResourceConfig } from "@flowpanel/core";
import { filterReadableProjection } from "@flowpanel/core";

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

export function declaredRowFields(resource: ResourceConfig): Set<string> {
  const fields = new Set<string>();
  const options = resource.options as {
    columns?: unknown[];
    rowKey?: string;
    drawer?: { fields?: unknown; tabs?: ReadonlyArray<{ fields?: unknown }> };
    detail?: { fields?: unknown; tabs?: ReadonlyArray<{ fields?: unknown }> };
  };

  for (const c of options.columns ?? []) addField(fields, c);
  fields.add(options.rowKey ?? "id");

  if (options.drawer) {
    addFieldList(fields, options.drawer.fields);
    for (const tab of options.drawer.tabs ?? []) addFieldList(fields, tab?.fields);
  }

  if (options.detail) {
    addFieldList(fields, options.detail.fields);
    for (const tab of options.detail.tabs ?? []) addFieldList(fields, tab?.fields);
  }

  return fields;
}

export function projectRow<Row extends Record<string, unknown>>(
  resource: ResourceConfig,
  row: Row,
  extraFields?: Iterable<string>,
): Row {
  const fields = declaredRowFields(resource);
  if (extraFields) {
    for (const f of extraFields) fields.add(f);
  }
  const out: Record<string, unknown> = {};
  for (const f of fields) {
    const policy = resource.options.fieldAccess?.[f];
    if (policy?.sensitive || policy?.read === false) continue;
    if (Object.hasOwn(row, f)) out[f] = row[f];
  }
  return out as unknown as Row;
}

/** Request-aware projection for every server/client and HTTP row boundary. */
export async function projectAuthorizedRow<Row extends Record<string, unknown>>(
  resource: ResourceConfig,
  row: Row,
  reqCtx: RequestContext,
  extraFields?: Iterable<string>,
): Promise<Row> {
  const fields = declaredRowFields(resource);
  if (extraFields) for (const field of extraFields) fields.add(field);
  const readable = await filterReadableProjection(
    [...fields],
    resource.options.fieldAccess,
    reqCtx,
  );
  const out: Record<string, unknown> = {};
  for (const field of readable) {
    if (Object.hasOwn(row, field)) out[field] = row[field];
  }
  return out as Row;
}
