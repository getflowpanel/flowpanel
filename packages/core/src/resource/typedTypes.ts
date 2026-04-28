/**
 * Typed builder internal shapes — emitted by `defineResource(table, opts)`.
 *
 * Kept separate from the legacy `Resolved*` types so the new builder can own
 * its own contract. `defineFlowPanel` lowers `TypedResourceDefinition` into
 * the existing `ResolvedResource` at config-load time (Task 6).
 */

import type { FpDb, FpSession } from "../types/augmentation";
import type { ColumnRef, ComputedColumnInput } from "./columnRefs";
import type { TableProxy } from "./tableProxy";
import type { ColumnFormat, FieldColumnOpts, FilterMode, FilterOpts } from "./types";

// ─── Columns ───────────────────────────────────────────────────────────────

export type TypedColumnInput<TRow> = ColumnRef | ComputedColumnInput<TRow>;

export interface TypedFieldColumn {
  kind: "field";
  id: string;
  path: string;
  label: string;
  format: ColumnFormat | "auto";
  opts: FieldColumnOpts;
  enumValues?: readonly string[];
  relationModel?: string;
}

export interface TypedComputedColumn<TRow = unknown, TValue = unknown> {
  kind: "computed";
  id: string;
  label: string;
  format: ColumnFormat | "auto";
  sortExpr?: string;
  compute?: (ctx: { row: TRow; db: FpDb; session: FpSession }) => Promise<TValue> | TValue;
  computeBatch?: (ctx: {
    rows: readonly TRow[];
    db: FpDb;
    session: FpSession;
  }) => Promise<ReadonlyMap<string | number, TValue>> | ReadonlyMap<string | number, TValue>;
}

export type TypedColumn<TRow = unknown> = TypedFieldColumn | TypedComputedColumn<TRow>;

// ─── Filters ───────────────────────────────────────────────────────────────

export interface TypedFilter {
  id: string;
  path: string;
  label: string;
  mode: FilterMode | "auto";
  opts: FilterOpts;
}

// ─── Actions ───────────────────────────────────────────────────────────────

export type TypedActionContext<TRow, TSession = FpSession> = {
  row: TRow;
  db: FpDb;
  session: TSession;
};

export type TypedBulkActionContext<TRow, TSession = FpSession> = {
  rows: readonly TRow[];
  db: FpDb;
  session: TSession;
};

export interface TypedRowAction<TRow = unknown, TSession = unknown> {
  type: "row";
  label: string;
  icon?: string;
  variant?: "default" | "danger";
  confirm?: string | ((ctx: { row: TRow }) => string);
  disabled?: (ctx: { row: TRow }) => boolean;
  stepUp?: boolean;
  run: (ctx: TypedActionContext<TRow, TSession>) => Promise<void> | void;
}

export interface TypedBulkAction<TRow = unknown, TSession = unknown> {
  type: "bulk";
  label: string;
  icon?: string;
  variant?: "default" | "danger";
  confirm?: string | ((ctx: { rows: readonly TRow[] }) => string);
  stepUp?: boolean;
  run: (ctx: TypedBulkActionContext<TRow, TSession>) => Promise<void> | void;
}

/**
 * Bulk-edit — opens a form for selected rows, applies the resulting patch.
 * `fields` is a list of column names (strings) from the resource; FlowPanel
 * auto-builds the form from the column metadata.
 */
export interface TypedBulkEditAction<TRow = unknown, TSession = unknown> {
  type: "bulkEdit";
  label: string;
  icon?: string;
  variant?: "default" | "danger";
  fields: readonly (keyof TRow & string)[];
  stepUp?: boolean;
  run: (ctx: {
    rows: readonly TRow[];
    patch: Partial<TRow>;
    db: FpDb;
    session: TSession;
  }) => Promise<void> | void;
}

export type TypedAction<TRow = unknown, TSession = unknown> =
  | TypedRowAction<TRow, TSession>
  | TypedBulkAction<TRow, TSession>
  | TypedBulkEditAction<TRow, TSession>;

// ─── defineResource options ────────────────────────────────────────────────

export interface DefineResourceOptions<TTable, TRow, TSession = unknown> {
  label?: string;
  labelPlural?: string;
  icon?: string;
  path?: string;
  defaultSort?: { field: keyof TRow & string; dir: "asc" | "desc" };
  defaultPageSize?: number;
  searchFields?: readonly (keyof TRow & string)[];

  columns: (t: TableProxy<TTable>) => readonly TypedColumnInput<TRow>[];
  filters?: (t: TableProxy<TTable>) => readonly ColumnRef[];
  actions?: Record<string, TypedAction<TRow, TSession>>;

  /** Key into the root `drawers` map (passed to `defineFlowPanel`). */
  drawer?: string;
  /** Enable pg LISTEN/NOTIFY updates for this resource's table. */
  realtime?: boolean;
  /** Enable CSV/JSON export toolbar button. */
  export?: boolean;
  /** Read-only view — hides create/update/delete primitives. */
  readOnly?: boolean;
}

// ─── Output ────────────────────────────────────────────────────────────────

export interface TypedResourceDefinition<TRow = unknown> {
  readonly kind: "typed-resource";
  readonly model: string;
  readonly primaryKey: string;
  readonly label: string;
  readonly labelPlural: string;
  readonly icon?: string;
  readonly path: string;
  readonly defaultSort?: { field: string; dir: "asc" | "desc" };
  readonly defaultPageSize: number;
  readonly searchFields: readonly string[];
  readonly columns: readonly TypedColumn<TRow>[];
  readonly filters: readonly TypedFilter[];
  readonly actions: Readonly<Record<string, TypedAction<TRow>>>;
  readonly drawer?: string;
  readonly realtime?: boolean;
  readonly export?: boolean;
  readonly readOnly?: boolean;
  /** Phantom row type. */
  readonly __row?: TRow;
}
