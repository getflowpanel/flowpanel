import { FlowpanelAccessError, resolveScopeApplier } from "@flowpanel/core";
import { type AnyColumn, and, eq, getTableName, is, SQL, sql, type Table } from "drizzle-orm";
import type { DrizzleDialect } from "./dialect";
import { firstRow } from "./drizzle-db";

export interface ScopeContext {
  boundScope?: { apply(query: unknown): unknown };
}

export type ScopedColumn = AnyColumn & {
  default?: unknown;
  defaultFn?: (() => unknown) | undefined;
  getSQLType?: () => string;
  mapToDriverValue?: (value: unknown) => unknown;
};

interface SelectableDb {
  select: (...args: unknown[]) => { from: (ref: Table) => unknown };
}

/** Runs the tenant predicate against a probe to collect the conditions it applies. */
export function captureScopeClauses(ctx: ScopeContext): SQL[] {
  const applyScope = resolveScopeApplier(ctx);
  if (!applyScope) return [];
  const captured: SQL[] = [];
  const probe = {
    where(cond: SQL) {
      captured.push(cond);
      return probe;
    },
  };
  applyScope(probe);
  if (captured.length === 0) {
    throw new FlowpanelAccessError(
      "the bound Drizzle scope predicate added no where clause. " +
        "Refusing to run an unscoped query.",
    );
  }
  return captured;
}

export function outOfScope(operation: "create" | "update"): FlowpanelAccessError {
  const subject = operation === "create" ? "the new row" : "the changed row";
  return new FlowpanelAccessError(
    `${operation} refused: ${subject} would fall outside the resource's tenant scope. ` +
      "Keep the tenant column at the current scope's value.",
  );
}

export async function rowSatisfiesScope(
  handle: SelectableDb,
  ref: Table,
  pkCol: AnyColumn,
  id: unknown,
  scopeClauses: SQL[],
): Promise<boolean> {
  const row = await firstRow(handle.select().from(ref), and(eq(pkCol, id), ...scopeClauses) as SQL);
  return row !== undefined;
}

const SQLITE_NUMBER = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/;
const PG_TYPE = /^[a-z_][a-z0-9_ ]*(\(\d+(, ?\d+)?\))?(\[\])*$/i;
const PG_SERIAL: Readonly<Record<string, string>> = {
  serial: "integer",
  smallserial: "smallint",
  bigserial: "bigint",
};

/** Mirrors SQLite column affinity, which converts only decimal number text, so the probe compares what would be stored. */
function sqliteAffine(value: unknown, type: string): unknown {
  if (type.includes("int") || /real|floa|doub|numeric|decimal/.test(type)) {
    return typeof value === "string" && SQLITE_NUMBER.test(value) ? Number(value) : value;
  }
  if (/char|clob|text/.test(type) && (typeof value === "number" || typeof value === "bigint")) {
    return String(value);
  }
  return value;
}

/** A value as the column would hold it: SQLite affinity, a cast to the column type on pg, as is on mysql. */
function typedValue(value: SQL | unknown, column: ScopedColumn, dialect: DrizzleDialect): SQL {
  const declared = column.getSQLType?.() ?? "";
  const type = declared.toLowerCase();
  let raw: SQL;
  if (is(value, SQL)) raw = value;
  else if (value === null || value === undefined) raw = sql`NULL`;
  else {
    const driverValue = column.mapToDriverValue ? column.mapToDriverValue(value) : value;
    raw = sql`${dialect === "sqlite" ? sqliteAffine(driverValue, type) : driverValue}`;
  }
  const target = dialect === "pg" ? pgCastTarget(declared) : undefined;
  return target ? sql`CAST(${raw} AS ${target})` : raw;
}

/** The type to cast to, keeping a mixed-case name such as `"TenantKind"` quoted; `undefined` leaves the value uncast. */
function pgCastTarget(declared: string): SQL | undefined {
  const serial = PG_SERIAL[declared.toLowerCase()];
  if (serial) return sql.raw(serial);
  if (!/[A-Z]/.test(declared)) return PG_TYPE.test(declared) ? sql.raw(declared) : undefined;
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(declared) ? sql`${sql.identifier(declared)}` : undefined;
}

/** What a create writes to a column the input leaves out: its default, or what its `$defaultFn` returns. */
function defaultOf(column: ScopedColumn): unknown {
  if (column.default !== undefined) return column.default;
  return column.defaultFn?.();
}

/** True when the row a write would produce satisfies the scope; `currentRow` is the row an update starts from. */
export function scopeHolds(
  dialect: DrizzleDialect,
  ref: Table,
  cols: Record<string, ScopedColumn>,
  input: Record<string, unknown>,
  scopeClauses: SQL[],
  currentRow?: SQL,
): SQL {
  const projected = Object.entries(cols).map(([key, column]) => {
    let value: SQL;
    if (key in input) value = typedValue(input[key], column, dialect);
    else if (currentRow) value = sql`${column}`;
    else value = typedValue(defaultOf(column), column, dialect);
    return sql`${value} AS ${sql.identifier(column.name)}`;
  });
  const row = currentRow
    ? sql`SELECT ${sql.join(projected, sql`, `)} FROM ${ref} WHERE ${currentRow}`
    : sql`SELECT ${sql.join(projected, sql`, `)}`;
  return sql`EXISTS (SELECT 1 FROM (${row}) AS ${sql.identifier(getTableName(ref))} WHERE ${and(...scopeClauses)})`;
}
