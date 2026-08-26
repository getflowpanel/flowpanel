import type { BoundAdapterScope } from "./bound-scope";
import type { InferDB } from "./registry";
import type { Scope, Session } from "./session";

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
  /** Stable correlation id generated once per request. */
  requestId?: string;
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

/** Read-only diagnostics passed to `hooks.onError`; it carries no database authority. */
export interface ErrorContext {
  readonly requestId: string;
  readonly operation?: string;
  readonly route?: string;
  readonly actorId?: string | null;
  readonly method: string;
  readonly url: string;
  readonly ip: string | null;
  readonly userAgent: string | null;
}

/** Base context for reads. Widget queries and option resolvers receive this. */
export interface QueryContext<Db = unknown> extends RequestContext {
  /** @deprecated Declare `unsafe: ["db"]` and use `ctx.unsafe.db`. Removal target: 0.3. */
  db: Db;
  /** Explicit escape hatch for trusted application callbacks. */
  unsafe?: { db: Db };
  /** Active date range — the dashboard picker, or all-time elsewhere. */
  dateRange: { from: Date; to: Date };
  /** Query string of the page being rendered. */
  searchParams: URLSearchParams;
  /** Aborted when the request is cancelled. Pass it to long queries. */
  signal: AbortSignal;
  /** Explicit adapter projection. Omitted only by the deprecated v1 bridge. */
  select?: readonly string[];
  /** Opaque request-bound tenant policy. */
  boundScope?: BoundAdapterScope;
  /** @deprecated Use `boundScope`. Removal target: 0.3. */
  applyScope?: (query: unknown) => unknown;
  /** @deprecated Use presence of `boundScope`. Removal target: 0.3. */
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
  /** Opaque request-bound tenant policy. */
  boundScope?: BoundAdapterScope;
  /** @deprecated Use `boundScope`. Removal target: 0.3. */
  applyScope?: (query: unknown) => unknown;
  /** @deprecated Use presence of `boundScope`. Removal target: 0.3. */
  scopeRequired?: boolean;
}

/** What every action's `run` receives as its last argument. */
export interface ActionContext<Db = InferDB> extends RequestContext {
  /** @deprecated Declare `unsafe: ["db"]` and use `ctx.unsafe.db`. Removal target: 0.3. */
  db: Db;
  /** Explicit escape hatch for trusted action implementations. */
  unsafe?: { db: Db };
  /** Caller identity — same derivation the audit trail uses (`auth.userId`, then `session.id`, then `session.user.id`). */
  actorId: string | null;
  /** Push a realtime message to every connected admin. */
  publish: (channel: string, payload?: unknown) => Promise<void>;
}
