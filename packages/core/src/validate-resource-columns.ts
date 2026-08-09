import type { ColumnMeta } from "./types/adapter.js";
import type { ResourceConfig } from "./types/resource.js";
import { didYouMean } from "./validate-resource-refs.js";

interface ColumnSite {
  /** Column name the config points at. */
  target: string;
  /** Human-readable config path, used verbatim in the error. */
  where: string;
}

function bareName(entry: unknown): string | null {
  if (typeof entry === "string") return entry;
  if (typeof entry === "number" || typeof entry === "symbol") return String(entry);
  return null;
}

function pushColumnSites(list: unknown, where: string, out: ColumnSite[]): void {
  if (!Array.isArray(list)) return;
  list.forEach((entry, i) => {
    const bare = bareName(entry);
    if (bare !== null) {
      out.push({ target: bare, where: `${where}[${i}]` });
      return;
    }
    if (!entry || typeof entry !== "object") return;
    const field = (entry as { field?: unknown }).field;
    if (typeof field === "string") out.push({ target: field, where: `${where}[${i}].field` });
  });
}

function pushFormFieldSites(list: unknown, where: string, out: ColumnSite[]): void {
  if (!Array.isArray(list)) return;
  list.forEach((entry, i) => {
    if (!entry || typeof entry !== "object") return;
    const name = (entry as { name?: unknown }).name;
    if (typeof name === "string") out.push({ target: name, where: `${where}[${i}].name` });
  });
}

function columnSites(resource: ResourceConfig): ColumnSite[] {
  const out: ColumnSite[] = [];
  const o = resource.options;
  pushColumnSites(o.columns, "columns", out);
  pushColumnSites(o.filters, "filters", out);
  if (o.defaultSort && typeof o.defaultSort.field === "string") {
    out.push({ target: o.defaultSort.field, where: "defaultSort.field" });
  }
  pushFormFieldSites(o.create?.fields, "create.fields", out);
  pushFormFieldSites(o.update?.fields, "update.fields", out);
  return out;
}

/**
 * Throws when a resource points at a column the adapter does not report. Skips
 * entirely when the introspection carries no columns — an adapter that cannot
 * resolve a ref reports nothing, and guessing would reject valid configs.
 */
export function validateResourceColumns(
  name: string,
  resource: ResourceConfig,
  introspected: readonly ColumnMeta[],
): void {
  if (introspected.length === 0) return;
  const known = introspected.map((c) => c.name);
  for (const site of columnSites(resource)) {
    if (known.includes(site.target)) continue;
    throw new Error(
      `resource "${name}" points at column "${site.target}" via ${site.where}, ` +
        `but the adapter reports no such column.${didYouMean(site.target, known)} ` +
        `Known columns: ${known.map((k) => `"${k}"`).join(", ")}.`,
    );
  }
}
