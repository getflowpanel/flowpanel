import type { InferDB } from "./registry.js";
import type { Scope, Session } from "./session.js";

export interface RequestContext {
  req: Request;
  session: Session | null;
  role: string;
  scope: Scope;
  ip: string | null;
  userAgent: string | null;
}

export interface QueryContext<Db = unknown> extends RequestContext {
  db: Db;
  dateRange: { from: Date; to: Date };
  searchParams: URLSearchParams;
  signal: AbortSignal;
  /**
   * Pre-bound tenant-scope predicate. The runtime captures the request's
   * `scope` value and the resource's `scope: (scope, query) => query`
   * function into a single closure, then hands the adapter this `applyScope`.
   * The adapter calls it with its own query representation (a drizzle query
   * builder / a prisma `where` object) so the scope condition is AND-ed into
   * every read and by-id mutation. Absent when the resource opts out with
   * `scope: "bypass"` or declares no scope.
   */
  applyScope?: (query: unknown) => unknown;
  /**
   * `true` when global `scope` is active AND the resource declares a function
   * `scope`. Adapters MUST fail-closed: if `scopeRequired` is `true` but
   * `applyScope` is missing, throw rather than run an unscoped query.
   */
  scopeRequired?: boolean;
}

export interface ListQueryContext<Row, Db = unknown> extends QueryContext<Db> {
  filters: Record<string, unknown>;
  sort: { field: keyof Row & string; dir: "asc" | "desc" } | null;
  page: number;
  pageSize: number;
  search: string;
  /**
   * When set, the adapter's `list` should filter out rows where `<column> IS NOT NULL`
   * (i.e. only show rows that have NOT been soft-deleted). Passed by the runtime
   * when `resource.options.delete.softDelete` is configured.
   */
  softDelete?: { column: string };
}

export interface ItemQueryContext<Db = unknown> extends QueryContext<Db> {
  id: string;
}

export interface MutationContext<Row, Db = unknown> extends RequestContext {
  db: Db;
  input: Partial<Row>;
  id?: string;
  /**
   * When set, the adapter's `delete` should perform `UPDATE … SET <column> = now()`
   * instead of a hard `DELETE`, and `restore` should `UPDATE … SET <column> = NULL`.
   * Passed by the runtime when `resource.options.delete.softDelete` is configured.
   */
  softDelete?: { column: string };
  /**
   * Pre-bound tenant-scope predicate (see `QueryContext.applyScope`). For
   * by-id mutations (`update` / `delete`) the adapter AND-s the captured
   * scope condition into the WHERE so a mutation can't touch an out-of-scope
   * row. Absent when the resource opts out (`scope: "bypass"`) or declares no
   * scope.
   */
  applyScope?: (query: unknown) => unknown;
  /**
   * `true` when global `scope` is active AND the resource declares a function
   * `scope`. Adapters MUST fail-closed (see `QueryContext.scopeRequired`).
   */
  scopeRequired?: boolean;
}

export interface ActionContext<Db = InferDB> extends RequestContext {
  db: Db;
  publish: (channel: string, payload?: unknown) => Promise<void>;
}
