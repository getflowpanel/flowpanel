import type { ColumnMeta } from "./types/adapter";
import type { ResourceConfig } from "./types/resource";
import { didYouMean } from "./validate-resource-refs";

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
  pushColumnSites(o.expose, "expose", out);
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
  resource.options.columns?.forEach((column: unknown, index: number) => {
    if (typeof column !== "object" || column === null) return;
    const candidate = column as { field?: unknown; render?: unknown };
    if (candidate.render !== undefined && candidate.field === undefined) {
      throw new Error(
        `resource "${name}" columns[${index}] uses render without declaring a field. ` +
          "Declare the row fields the server renderer needs.",
      );
    }
  });
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
