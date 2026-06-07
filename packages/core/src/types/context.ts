import type { InferDB } from "./registry.js";
import type { Scope, Session } from "./session.js";

/** Structured decode of a `numeric-range` / `daterange` `FilterDef` value. */
export interface FilterRangeValue {
  op: "range";
  gte?: number | Date;
  lte?: number | Date;
}

/** Structured decode of a `multiselect` `FilterDef` value: match ANY of `values`. */
export interface FilterInValue {
  op: "in";
  values: string[];
}

export type StructuredFilterValue = FilterRangeValue | FilterInValue;

/** Runtime discriminant for `FilterRangeValue` — `filters` is `Record<string, unknown>`. */
export function isFilterRangeValue(v: unknown): v is FilterRangeValue {
  return typeof v === "object" && v !== null && (v as { op?: unknown }).op === "range";
}

/** Runtime discriminant for `FilterInValue` — `filters` is `Record<string, unknown>`. */
export function isFilterInValue(v: unknown): v is FilterInValue {
  return typeof v === "object" && v !== null && (v as { op?: unknown }).op === "in";
}

/** Everything the runtime knows about the caller. Every other context extends it. */
export interface RequestContext {
  /** The incoming request. Built from the real headers, even during page renders. */
  req: Request;
  /** Result of `AuthConfig.session` for this request. */
  session: Session | null;
  /** Result of `AuthConfig.role` for this session. */
  role: string;
  /** Tenant scope resolved by the admin-wide `scope`. Null when unscoped. */
  scope: Scope;
  /** Caller IP from `x-forwarded-for`, when the proxy sets it. */
  ip: string | null;
  userAgent: string | null;
}

/** Base context for reads. Widget queries and option resolvers receive this. */
export interface QueryContext<Db = unknown> extends RequestContext {
  /** Your database client, exactly as handed to the adapter. */
  db: Db;
  /** Active date range — the dashboard picker, or all-time elsewhere. */
  dateRange: { from: Date; to: Date };
  /** Query string of the page being rendered. */
  searchParams: URLSearchParams;
  /** Aborted when the request is cancelled. Pass it to long queries. */
  signal: AbortSignal;
  /** Pre-bound tenant-scope predicate. */
  applyScope?: (query: unknown) => unknown;
  /** `true` when global `scope` is active AND the resource declares a function `scope`. */
  scopeRequired?: boolean;
}

export interface ListQueryContext<Row, Db = unknown> extends QueryContext<Db> {
  /** Filter values keyed by declared field name. */
  filters: Record<string, unknown>;
  /** Active sort, or null when the list is unsorted. */
  sort: { field: keyof Row & string; dir: "asc" | "desc" } | null;
  /** 1-based page number. */
  page: number;
  pageSize: number;
  /** Current search term. Empty string when the box is blank. */
  search: string;
  /** Allowlist of columns `search` is OR-ed across, taken verbatim from `resource.options.search`. */
  searchFields?: string[];
  /** Set when the resource declares `delete.softDelete` — deleted rows are filtered out. */
  softDelete?: { column: string };
  /** Include soft-deleted rows, for the "show deleted" view. */
  includeDeleted?: boolean;
}

/** Read context for a single row. */
export interface ItemQueryContext<Db = unknown> extends QueryContext<Db> {
  /** Primary key of the requested row, as it appeared in the URL. */
  id: string;
}

/** Context for writes. Adapters receive this for create / update / delete / restore. */
export interface MutationContext<Row, Db = unknown> extends RequestContext {
  /** Your database client, exactly as handed to the adapter. */
  db: Db;
  /** Values to write, already coerced and validated. */
  input: Partial<Row>;
  /** Target row id. Absent on create. */
  id?: string;
  /** Set when the resource declares `delete.softDelete` — delete stamps the column. */
  softDelete?: { column: string };
  /** Pre-bound tenant-scope predicate (see `QueryContext.applyScope`). */
  applyScope?: (query: unknown) => unknown;
  /** `true` when global `scope` is active AND the resource declares a function `scope`. */
  scopeRequired?: boolean;
}

/** What every action's `run` receives as its last argument. */
export interface ActionContext<Db = InferDB> extends RequestContext {
  /** Your database client, exactly as handed to the adapter. */
  db: Db;
  /** Push a realtime message to every connected admin. */
  publish: (channel: string, payload?: unknown) => Promise<void>;
}
