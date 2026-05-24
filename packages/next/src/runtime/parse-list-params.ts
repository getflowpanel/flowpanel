import type { FilterDef, FilterType } from "@flowpanel/core";

export interface ListParams {
  page: number;
  search: string;
  sort: { field: string; dir: "asc" | "desc" } | null;
  filters: Record<string, unknown>;
}

/**
 * Parse list URL params into the shape the adapter list query expects.
 *
 * When `allowedFields` is supplied (the set of fields the resource declares
 * as filterable/sortable — see `declaredFieldSet`), filter keys and the sort
 * field are validated against it: unknown filter keys are dropped and an
 * unknown sort field is ignored (falls back to `defaultSort` / null). This
 * closes the unvalidated-filter/sort data-oracle — a hand-crafted
 * `?f_passwordHash=…` or `?sort=ssn:asc` can't probe undeclared columns.
 * Omitting `allowedFields` preserves the prior permissive behavior (used by
 * call sites that don't have a declared-field set, and by the unit tests).
 */
export function parseListParams(
  sp: URLSearchParams,
  defaultSort?: { field: string; dir: "asc" | "desc" },
  allowedFields?: ReadonlySet<string>,
): ListParams {
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const search = sp.get("q") ?? "";

  const sortRaw = sp.get("sort");
  const sort: ListParams["sort"] = sortRaw
    ? (() => {
        const [field, dir] = sortRaw.split(":");
        if (!field || (dir !== "asc" && dir !== "desc")) return null;
        // Ignore a sort on an undeclared field.
        if (allowedFields && !allowedFields.has(field)) return null;
        return { field, dir };
      })()
    : defaultSort
      ? { field: defaultSort.field, dir: defaultSort.dir }
      : null;

  const filters: Record<string, unknown> = {};
  for (const [k, v] of sp.entries()) {
    if (!k.startsWith("f_")) continue;
    const field = k.slice(2);
    // Drop filters on undeclared fields.
    if (allowedFields && !allowedFields.has(field)) continue;
    filters[field] = v;
  }

  return { page, search, sort, filters };
}

/**
 * Build the allowlist of fields a resource exposes for filtering / sorting.
 * Union of declared column fields (`options.columns`), declared filter fields
 * (`options.filters`), declared search fields (`options.search`), and the
 * default-sort field — every field the resource author opted in to. Anything
 * outside this set is rejected by `parseListParams`.
 */
export function declaredFieldSet(options: {
  columns?: unknown[] | undefined;
  filters?: unknown[] | undefined;
  search?: unknown[] | undefined;
  defaultSort?: { field: string } | undefined;
}): Set<string> {
  const fields = new Set<string>();
  const add = (entry: unknown): void => {
    if (typeof entry === "string") {
      if (entry) fields.add(entry);
      return;
    }
    if (entry && typeof entry === "object") {
      const f = (entry as { field?: unknown }).field;
      if (typeof f === "string" && f) fields.add(f);
    }
  };
  for (const c of options.columns ?? []) add(c);
  for (const f of options.filters ?? []) add(f);
  for (const s of options.search ?? []) add(s);
  if (options.defaultSort?.field) fields.add(options.defaultSort.field);
  return fields;
}

export interface ResolvedFilterSpec {
  field: string;
  type: FilterType;
  label?: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
}

export async function resolveFilterSpecs<Row>(
  defs: (keyof Row | FilterDef<Row>)[] | undefined,
  ctx: unknown,
): Promise<ResolvedFilterSpec[]> {
  if (!defs || defs.length === 0) return [];
  const out: ResolvedFilterSpec[] = [];
  for (const d of defs) {
    if (typeof d === "string" || typeof d === "number" || typeof d === "symbol") {
      out.push({ field: String(d), type: "text" });
      continue;
    }
    const def = d as FilterDef<Row>;
    let options: { label: string; value: string }[] | undefined;
    if (typeof def.options === "function") {
      const resolved = await def.options(ctx as never);
      options = resolved.map((o) => ({ label: o.label, value: String(o.value) }));
    } else if (Array.isArray(def.options)) {
      options = def.options.map((o) => {
        // String shorthand: `["a", "b"]` → `[{label:"a",value:"a"}, …]`.
        if (typeof o === "string") return { label: o, value: o };
        return { label: o.label, value: String(o.value) };
      });
    }
    out.push({
      field: String(def.field),
      type: def.type,
      ...(def.label ? { label: def.label } : {}),
      ...(options ? { options } : {}),
    });
  }
  return out;
}
