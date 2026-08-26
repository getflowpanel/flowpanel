import type { FilterDef, FilterInValue, FilterRangeValue, FilterType } from "@flowpanel/core";
import { toWireOptions } from "./select-options";

export interface ListParams {
  page: number;
  search: string;
  sort: { field: string; dir: "asc" | "desc" } | null;
  filters: Record<string, unknown>;
}

/** Highest page number `?page=` may request — beyond this it's abuse, not real pagination. */
const MAX_PAGE = 100_000;

/** Clamp `?page=` to a positive integer no larger than `MAX_PAGE`; non-finite/garbage → 1. */
export function parsePage(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_PAGE);
}

/** Highest `?pageSize=` a caller may ask for in one page of JSON. */
const MAX_PAGE_SIZE = 200;

/** Clamp `?pageSize=` into the range a single response may carry; garbage → `fallback`. */
export function parsePageSize(raw: string | null, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_PAGE_SIZE);
}

/** Parse list URL params into the shape the adapter list query expects. */
export function parseListParams(
  sp: URLSearchParams,
  defaultSort?: { field: string; dir: "asc" | "desc" },
  allowedFields?: ReadonlySet<string>,
): ListParams {
  const page = parsePage(sp.get("page"));
  const search = sp.get("q") ?? "";

  const sortRaw = sp.get("sort");
  const sort: ListParams["sort"] = sortRaw
    ? (() => {
        const [field, dir] = sortRaw.split(":");
        if (!field || (dir !== "asc" && dir !== "desc")) return null;
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
    if (allowedFields && !allowedFields.has(field)) continue;
    filters[field] = v;
  }

  return { page, search, sort, filters };
}

/** Build the allowlist of fields a resource exposes for filtering / sorting. */
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
      options = toWireOptions(await def.options(ctx as never));
    } else if (Array.isArray(def.options)) {
      options = toWireOptions(def.options);
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

/** `FilterDef.defaultValue` sentinels — always pass through untouched, for every filter type. */
const FILTER_NULL_SENTINELS = new Set(["__null__", "__notnull__"]);

/** Strict `YYYY-MM-DD` — what `<input type="date">` (`DateRangeFilter`) emits. */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse one side of a `numeric-range` value; `undefined` if empty or not a finite number. */
function decodeNumericBound(raw: string): number | undefined {
  if (raw === "" || !Number.isFinite(Number(raw))) return undefined;
  return Number(raw);
}

/** Parse one side of a `daterange` value; `undefined` if empty or not a valid `YYYY-MM-DD`. */
function decodeDateBound(raw: string, endOfDay: boolean): Date | undefined {
  if (!DATE_ONLY_RE.test(raw)) return undefined;
  const d = new Date(`${raw}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Coerce/validate/decode a single filter value against its resolved `FilterDef`. */
function sanitizeFilterValue(value: string, spec: ResolvedFilterSpec | undefined): unknown {
  if (FILTER_NULL_SENTINELS.has(value)) return value;
  if (!spec) return value;

  switch (spec.type) {
    case "select": {
      if (!spec.options) return value;
      const allowed = new Set(spec.options.map((o) => o.value));
      return allowed.has(value) ? value : undefined;
    }
    case "multiselect": {
      const parts = value
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const kept = spec.options
        ? (() => {
            const allowed = new Set(spec.options?.map((o) => o.value));
            return parts.filter((v) => allowed.has(v));
          })()
        : parts;
      return kept.length > 0 ? ({ op: "in", values: kept } satisfies FilterInValue) : undefined;
    }
    case "boolean":
      return value === "true" || value === "false" ? value : undefined;
    case "numeric-range": {
      const [minRaw = "", maxRaw = ""] = value.split(":");
      const gte = decodeNumericBound(minRaw);
      const lte = decodeNumericBound(maxRaw);
      if (gte === undefined && lte === undefined) return undefined;
      return {
        op: "range",
        ...(gte !== undefined ? { gte } : {}),
        ...(lte !== undefined ? { lte } : {}),
      } satisfies FilterRangeValue;
    }
    case "daterange": {
      const [fromRaw = "", toRaw = ""] = value.split(":");
      const gte = decodeDateBound(fromRaw, false);
      const lte = decodeDateBound(toRaw, true);
      if (gte === undefined && lte === undefined) return undefined;
      return {
        op: "range",
        ...(gte !== undefined ? { gte } : {}),
        ...(lte !== undefined ? { lte } : {}),
      } satisfies FilterRangeValue;
    }
    default:
      return value;
  }
}

export function sanitizeFilterValues(
  filters: Record<string, unknown>,
  specs: ReadonlyArray<ResolvedFilterSpec>,
): Record<string, unknown> {
  const byField = new Map(specs.map((s) => [s.field, s]));
  const out: Record<string, unknown> = {};
  for (const [field, raw] of Object.entries(filters)) {
    if (typeof raw !== "string") {
      out[field] = raw;
      continue;
    }
    const kept = sanitizeFilterValue(raw, byField.get(field));
    if (kept !== undefined) out[field] = kept;
  }
  return out;
}
