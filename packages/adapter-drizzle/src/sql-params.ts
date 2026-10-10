import { type ParseSqlRowsOptions, parseSqlRows, sanitizeSqlParams } from "@flowpanel/core";
import { is, SQL, sql } from "drizzle-orm";
import type { DrizzleDialect } from "./dialect";
import { type MigrationDb, selectRaw } from "./migrations";

function copyWith<T extends object>(source: T, change: Partial<T>): T {
  return Object.assign(Object.create(Object.getPrototypeOf(source)) as T, source, change);
}

function bindableAll(values: readonly unknown[]): readonly unknown[] {
  const mapped = values.map(bindable);
  return mapped.every((value, i) => value === values[i]) ? values : mapped;
}

function bindable(value: unknown): unknown {
  if (is(value, SQL)) return fragment(value);
  if (is(value, SQL.Aliased)) {
    const inner = fragment(value.sql);
    return inner === value.sql ? value : copyWith(value, { sql: inner });
  }
  if (Array.isArray(value)) return bindableAll(value);
  return sanitizeSqlParams([value])[0];
}

/** A fragment with every nested `Date` and `bigint` bindable, copied only when something changes. */
function fragment(query: SQL): SQL {
  const chunks = bindableAll(query.queryChunks);
  if (chunks === query.queryChunks) return query;
  return copyWith(query, { queryChunks: chunks as SQL["queryChunks"] });
}

/** One bound read-only statement, with the driver's row shape normalised away. */
export async function rawSqlRows<Row>(
  db: MigrationDb,
  dialect: DrizzleDialect,
  strings: TemplateStringsArray,
  values: readonly unknown[],
  options: ParseSqlRowsOptions = {},
): Promise<Row[]> {
  const query: SQL = sql(strings, ...values.map(bindable));
  return parseSqlRows<Row>(await selectRaw(db, dialect, query), options);
}
