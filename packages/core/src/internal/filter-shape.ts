import type { ResourceConfig } from "@flowpanel/core";
import { quoted } from "./validate-shared";
import { DATE_RANGE_PRESETS } from "./zone-time";

type Needed = "multiselect" | "numeric-range" | "daterange";

const SENTINELS = new Set(["__null__", "__notnull__"]);

function needs(value: unknown): Needed | null {
  if (Array.isArray(value)) return "multiselect";
  if (typeof value !== "object" || value === null) return null;
  const shaped = value as { op?: unknown; gte?: unknown; lte?: unknown };
  if (shaped.op === "in") return "multiselect";
  if (shaped.op !== "range" && !("gte" in shaped) && !("lte" in shaped)) return null;
  return shaped.gte instanceof Date || shaped.lte instanceof Date ? "daterange" : "numeric-range";
}

const DATE_PRESETS: ReadonlySet<string> = new Set(DATE_RANGE_PRESETS);

function declaredFilter(
  resource: ResourceConfig,
  field: string,
): { type?: unknown; options?: unknown } | null {
  for (const entry of (resource.options.filters ?? []) as unknown[]) {
    if (entry === field) return { type: "text" };
    const def = entry as { field?: unknown } | null;
    if (typeof entry === "object" && def?.field === field) return entry as { type?: unknown };
  }
  return null;
}

function optionValues(options: unknown): string[] | null {
  if (!Array.isArray(options)) return null;
  return options.map((option) =>
    typeof option === "string" ? option : String((option as { value?: unknown }).value),
  );
}

/**
 * Why the list's URL would read `value` on `field` as other rows than a count or a `where`
 * matches, or `null` when it reads the same rows. The list decodes an array only through a
 * `multiselect` filter, numeric bounds through `numeric-range`, dates through `daterange`, a
 * filter named by a bare string as text, a single value on a range filter as an open-ended
 * bound, a `Date` as its day, and a `select` filter with fixed options drops any other value.
 */
export function filterShapeProblem(
  resource: ResourceConfig,
  field: string,
  value: unknown,
): string | null {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    return 'a Date matches one instant while the list reads it as a day, from that day onwards on a "daterange" filter (pass { gte, lte })';
  }
  const filter = declaredFilter(resource, field);
  const type = typeof filter?.type === "string" ? filter.type : null;
  const needed = needs(value);
  if (needed === null) {
    const text = String(value);
    if (SENTINELS.has(text)) return null;
    if (type === "numeric-range" || (type === "daterange" && !DATE_PRESETS.has(text))) {
      return `the list reads "${field}" through a "${type}" filter, which turns a single value into an open-ended bound (pass { gte, lte })`;
    }
    const allowed = type === "select" ? optionValues(filter?.options) : null;
    if (allowed === null || allowed.includes(text)) return null;
    return `its "select" filter on "${field}" offers ${quoted(allowed)}, so the list drops "${text}"`;
  }
  if (type === needed) return null;
  const read = type ? `through a "${type}" filter` : "as plain text";
  return `the list reads "${field}" ${read}, and this value needs a "${needed}" filter there`;
}
