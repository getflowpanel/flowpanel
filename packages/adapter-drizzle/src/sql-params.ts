import { type ParseSqlRowsOptions, parseSqlRows, sanitizeSqlParams } from "@flowpanel/core";
import { type SQL, sql } from "drizzle-orm";
import type { DrizzleDialect } from "./dialect";
import { type MigrationDb, selectRaw } from "./migrations";

/** One bound read-only statement, with the driver's row shape normalised away. */
export async function rawSqlRows<Row>(
  db: MigrationDb,
  dialect: DrizzleDialect,
  strings: TemplateStringsArray,
  values: readonly unknown[],
  options: ParseSqlRowsOptions = {},
): Promise<Row[]> {
  const query: SQL = sql(strings, ...sanitizeSqlParams(values));
  return parseSqlRows<Row>(await selectRaw(db, dialect, query), options);
}
