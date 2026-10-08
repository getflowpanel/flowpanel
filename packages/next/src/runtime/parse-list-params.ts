import type {
  FilterDef,
  FilterInValue,
  FilterRangeValue,
  FilterType,
  QueryContext,
  RequestContext,
} from "@flowpanel/core";
import { runWithRequestContext } from "@flowpanel/core";
import { encodeFilterValue } from "@flowpanel/core/internal";
import { dayBoundsIn, isDateRangePreset, resolveDateRange } from "./date-range";
import { toWireOptions } from "./select-options";

export { declaredListFields as declaredFieldSet } from "@flowpanel/core/internal";

export interface ListParams {
  page: number;
  search: string;
  sort: { field: string; dir: "asc" | "desc" } | null;
  filters: Record<string, unknown>;
}

/** Highest page number `?page=` may request — beyond this it's abuse, not real pagination. */
export const MAX_PAGE = 100_000;

/** Clamp `?page=` to a positive integer no larger than `MAX_PAGE`; non-finite/garbage → 1. */
export function parsePage(raw: string | null): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_PAGE);
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

export interface ResolvedFilterSpec {
  field: string;
  type: FilterType;
  label?: string;
  options?: { label: string; value: string }[];
  placeholder?: string;
  /** `FilterDef.defaultValue` in its `f_<field>` URL form. */
  defaultValue?: string;
  hidden?: boolean;
}

/** Each filter's control; an `options` function gets the request's query context, scope included. */
export async function resolveFilterSpecs<Row>(
  defs: (keyof Row | FilterDef<Row>)[] | undefined,
  reqCtx: RequestContext,
  timeZone = "UTC",
  searchParams: URLSearchParams = new URLSearchParams(),
): Promise<ResolvedFilterSpec[]> {
  if (!defs || defs.length === 0) return [];
  const queryCtx: QueryContext = {
    ...reqCtx,
    dateRange: { from: new Date(0), to: new Date() },
    searchParams,
    signal: new AbortController().signal,
  };
  const out: ResolvedFilterSpec[] = [];
  for (const d of defs) {
    if (typeof d === "string" || typeof d === "number" || typeof d === "symbol") {
      out.push({ field: String(d), type: "text" });
      continue;
    }
    const def = d as FilterDef<Row>;
    let options: { label: string; value: string }[] | undefined;
    const resolve = def.options;
    if (typeof resolve === "function") {
      options = toWireOptions(await runWithRequestContext(reqCtx, () => resolve(queryCtx)));
    } else if (Array.isArray(def.options)) {
      options = toWireOptions(def.options);
    }
    const defaultValue = encodeFilterValue(def.defaultValue, timeZone);
    out.push({
      field: String(def.field),
      type: def.type,
      ...(def.label ? { label: def.label } : {}),
      ...(options ? { options } : {}),
      ...(defaultValue !== null ? { defaultValue } : {}),
      ...(def.hidden ? { hidden: true } : {}),
    });
  }
  return out;
}

/** Each filter's default for a field the request names no value for; an empty value keeps it off. */
export function withFilterDefaults(
  filters: Record<string, unknown>,
  specs: ReadonlyArray<ResolvedFilterSpec>,
): Record<string, unknown> {
  const out = { ...filters };
  for (const spec of specs) {
    if (spec.defaultValue !== undefined && !(spec.field in out))
      out[spec.field] = spec.defaultValue;
  }
  return out;
}

/** Null sentinels a filter value may carry — always pass through untouched, for every filter type. */
const FILTER_NULL_SENTINELS = new Set(["__null__", "__notnull__"]);

/** Strict `YYYY-MM-DD` — what `<input type="date">` (`DateRangeFilter`) emits. */
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parse one side of a `numeric-range` value; `undefined` if empty or not a finite number. */
function decodeNumericBound(raw: string): number | undefined {
  if (raw === "" || !Number.isFinite(Number(raw))) return undefined;
  return Number(raw);
}

/** Parse one side of a `daterange` value; `undefined` if empty or not a valid `YYYY-MM-DD`. */
function decodeDateBound(raw: string, endOfDay: boolean, timeZone: string): Date | undefined {
  if (!DATE_ONLY_RE.test(raw) || Number.isNaN(Date.parse(raw))) return undefined;
  const bounds = dayBoundsIn(raw, timeZone);
  return endOfDay ? bounds.end : bounds.start;
}

/** Parse one side of a `from~to` daterange value: an ISO-8601 instant. */
function decodeInstant(raw: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw)) return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Coerce/validate/decode a single filter value against its resolved `FilterDef`. */
function sanitizeFilterValue(
  value: string,
  spec: ResolvedFilterSpec | undefined,
  timeZone: string,
): unknown {
  if (value === "") return undefined;
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
      if (isDateRangePreset(value)) {
        const { from, to } = resolveDateRange({ preset: value }, timeZone);
        return { op: "range", gte: from, lte: to } satisfies FilterRangeValue;
      }
      const instants = value.includes("~");
      const [fromRaw = "", toRaw = ""] = value.split(instants ? "~" : ":");
      const gte = instants ? decodeInstant(fromRaw) : decodeDateBound(fromRaw, false, timeZone);
      const lte = instants ? decodeInstant(toRaw) : decodeDateBound(toRaw, true, timeZone);
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
  timeZone = "UTC",
): Record<string, unknown> {
  const byField = new Map(specs.map((s) => [s.field, s]));
  const out: Record<string, unknown> = {};
  for (const [field, raw] of Object.entries(filters)) {
    if (typeof raw !== "string") {
      out[field] = raw;
      continue;
    }
    const kept = sanitizeFilterValue(raw, byField.get(field), timeZone);
    if (kept !== undefined) out[field] = kept;
  }
  return out;
}
