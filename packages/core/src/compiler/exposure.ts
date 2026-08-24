import type { ResourceIntrospection } from "../types/adapter.js";
import type { ResourceConfig } from "../types/resource.js";

export interface ResourceExposure {
  clientProjection: readonly string[];
  serverProjection: readonly string[];
}

function addName(target: Set<string>, value: unknown): void {
  if (typeof value === "string") target.add(value);
  else if (typeof value === "number" || typeof value === "symbol") target.add(String(value));
}

function addFieldEntries(target: Set<string>, value: unknown, wildcard: readonly string[]): void {
  if (value === "*") {
    wildcard.forEach((field) => {
      target.add(field);
    });
    return;
  }
  if (!Array.isArray(value)) return;
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) {
      addName(target, entry);
      continue;
    }
    const candidate = entry as { field?: unknown; name?: unknown };
    addName(target, candidate.field ?? candidate.name);
  }
}

/** Build the allowlisted row projections used by server rendering and client serialization. */
export function collectResourceExposure(
  resource: ResourceConfig,
  introspection: ResourceIntrospection | null,
): ResourceExposure {
  const options = resource.options;
  const introspected =
    introspection?.columns
      .filter((column) => column.readable !== false && column.sensitive !== true)
      .map((column) => column.name) ?? [];
  const client = new Set<string>();

  addFieldEntries(client, options.columns, introspected);
  addFieldEntries(client, options.expose, introspected);
  addName(client, options.rowKey ?? introspection?.primaryKey ?? "id");
  addFieldEntries(client, options.search, introspected);
  addFieldEntries(client, options.filters, introspected);
  addFieldEntries(client, options.detail?.fields, introspected);
  addFieldEntries(client, options.drawer?.fields, introspected);
  addFieldEntries(client, options.export ? options.export.fields : [], introspected);

  for (const tab of options.detail?.tabs ?? []) addFieldEntries(client, tab.fields, introspected);
  for (const tab of options.drawer?.tabs ?? []) {
    if ("fields" in tab) addFieldEntries(client, tab.fields, introspected);
  }

  const server = new Set(client);
  if (Array.isArray(options.columns)) {
    for (const column of options.columns) {
      if (typeof column !== "object" || column === null) continue;
      const select = (column as { select?: unknown }).select;
      addFieldEntries(server, select, introspected);
    }
  }

  for (const [field, policy] of Object.entries(options.fieldAccess ?? {})) {
    if (policy?.sensitive || policy?.read === false) {
      client.delete(field);
      server.delete(field);
    }
  }

  for (const column of introspection?.columns ?? []) {
    if (column.readable === false || column.sensitive === true) {
      client.delete(column.name);
      server.delete(column.name);
    }
  }

  return {
    clientProjection: [...client],
    serverProjection: [...server],
  };
}
