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
}

export interface ActionContext<Db = unknown> extends RequestContext {
  db: Db;
  publish: (channel: string, payload?: unknown) => Promise<void>;
}
