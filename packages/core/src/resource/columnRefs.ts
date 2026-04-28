/**
 * ColumnRef — a branded token captured by the column selector of
 * `defineResource`. Its runtime shape is opaque; its TypeScript shape carries
 * the column's value type so downstream callbacks (`compute`, `computeBatch`,
 * action `run`) inherit typed `row` parameters.
 *
 * Consumers never construct ColumnRefs directly — they're produced by
 * `TableProxy.<columnName>` (see `tableProxy.ts`).
 */

import type { FieldMetadata } from "./types";

const COLUMN_REF_BRAND = Symbol.for("flowpanel.ColumnRef");

export interface ColumnRef<TValue = unknown> {
  readonly [COLUMN_REF_BRAND]: true;
  readonly path: string;
  readonly metadata: FieldMetadata;
  /** Phantom marker — exists only at the type level. */
  readonly __value?: TValue;
}

export function makeColumnRef<TValue>(path: string, metadata: FieldMetadata): ColumnRef<TValue> {
  return Object.freeze({
    [COLUMN_REF_BRAND]: true,
    path,
    metadata,
  }) as ColumnRef<TValue>;
}

export function isColumnRef(value: unknown): value is ColumnRef {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { [COLUMN_REF_BRAND]?: unknown })[COLUMN_REF_BRAND] === true
  );
}

/**
 * Context passed to computed column callbacks. `db` and `session` flow
 * from the user's `declare module "@flowpanel/core" { interface FlowPanelTypes }`
 * augmentation — no cast needed inside callbacks.
 */
export interface ComputeContext<TRow = unknown> {
  readonly row: TRow;
  readonly db: import("../types/augmentation").FpDb;
  readonly session: import("../types/augmentation").FpSession;
}

export interface BatchComputeContext<TRow = unknown> {
  readonly rows: readonly TRow[];
  readonly db: import("../types/augmentation").FpDb;
  readonly session: import("../types/augmentation").FpSession;
}

/**
 * Computed column — object form declared inline inside a column selector.
 *
 * Prefer `computeBatch` when the value comes from the database: it receives
 * all rows at once and returns a Map keyed by primary key, avoiding N+1.
 * Use `compute` only for trivial per-row transforms that don't hit I/O.
 */
export interface ComputedColumnInput<TRow = unknown, TValue = unknown> {
  readonly id: string;
  readonly label?: string;
  readonly format?: string;
  /**
   * Raw SQL expression used to support `ORDER BY` on this computed column.
   * If omitted, the UI renders it as non-sortable.
   */
  readonly sortExpr?: string;
  readonly compute?: (ctx: ComputeContext<TRow>) => Promise<TValue> | TValue;
  readonly computeBatch?: (
    ctx: BatchComputeContext<TRow>,
  ) => Promise<ReadonlyMap<string | number, TValue>> | ReadonlyMap<string | number, TValue>;
}

export function isComputedColumnInput(value: unknown): value is ComputedColumnInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string") return false;
  return typeof v.compute === "function" || typeof v.computeBatch === "function";
}
