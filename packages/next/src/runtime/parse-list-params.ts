import type { FilterDef, FilterType } from "@flowpanel/core";

export interface ListParams {
  page: number;
  search: string;
  sort: { field: string; dir: "asc" | "desc" } | null;
  filters: Record<string, unknown>;
}

export function parseListParams(
  sp: URLSearchParams,
  defaultSort?: { field: string; dir: "asc" | "desc" },
): ListParams {
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const search = sp.get("q") ?? "";

  const sortRaw = sp.get("sort");
  const sort: ListParams["sort"] = sortRaw
    ? (() => {
        const [field, dir] = sortRaw.split(":");
        return field && (dir === "asc" || dir === "desc") ? { field, dir } : null;
      })()
    : defaultSort
      ? { field: defaultSort.field, dir: defaultSort.dir }
      : null;

  const filters: Record<string, unknown> = {};
  for (const [k, v] of sp.entries()) {
    if (!k.startsWith("f_")) continue;
    filters[k.slice(2)] = v;
  }

  return { page, search, sort, filters };
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
      options = def.options.map((o) => ({ label: o.label, value: String(o.value) }));
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
